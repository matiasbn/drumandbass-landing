-- FIX DE SEGURIDAD: los CÓDIGOS de cupón viven en cms_events, pero la RLS
-- public-read exponía las columnas `coupon_junglist_new` / `coupon_junglist` a la
-- key anon (que va en el bundle del front). O sea cualquiera podía leer todos los
-- códigos con una consulta directa — rompiendo el modelo de gating (el código solo
-- debe salir vía get_event_coupon, contra sesión + estado junglist).
--
-- Solución: ocultar esos 2 códigos de anon y authenticated (grants por columna) y
-- exponer solo un booleano "tiene descuento" para el badge público. Los códigos
-- siguen accesibles vía get_event_coupon (SECURITY DEFINER, corre como owner, no
-- le afectan estos grants). `coupon_set_at` NO es secreto (es un timestamp) y el
-- envío de campaña lo lee → se deja visible.
--
-- OJO: al pasar a grants por columna, cualquier columna NUEVA de cms_events debe
-- agregarse al GRANT de abajo, o no será visible para el front.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

-- Booleanos públicos derivados (para el badge "Descuento Junglist" sin exponer el código).
ALTER TABLE cms_events
  ADD COLUMN IF NOT EXISTS has_coupon_new BOOLEAN
    GENERATED ALWAYS AS (coupon_junglist_new IS NOT NULL) STORED,
  ADD COLUMN IF NOT EXISTS has_coupon_existing BOOLEAN
    GENERATED ALWAYS AS (coupon_junglist IS NOT NULL) STORED;

-- Reemplazar el SELECT de tabla completa por un SELECT por columnas SIN los códigos.
REVOKE SELECT ON cms_events FROM anon, authenticated;
GRANT SELECT (
  id, title, venue, address, date, end_date, description_html, tickets, info,
  flyer_url, flyer_width, flyer_height, created_at, updated_at, ticket_links,
  coupon_set_at, has_coupon_new, has_coupon_existing
) ON cms_events TO anon, authenticated;
