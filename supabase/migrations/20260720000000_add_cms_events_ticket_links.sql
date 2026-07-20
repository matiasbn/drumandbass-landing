-- Historial de URLs de tickets por evento (para analytics).
--
-- Analytics cruza los clics salientes (que GA registra por URL) con la URL de
-- venta del evento. Si esa URL cambia (p. ej. parten con un link de Instagram y
-- luego ponen la ticketera), los clics a la URL vieja quedarían huérfanos. Al
-- guardar TODAS las URLs que usó un evento, ninguna se pierde y el desglose por
-- evento suma los clics de todas sus URLs.
--
-- `tickets` sigue siendo la URL ACTIVA (la que muestra el sitio público en el
-- botón TICKETS). `ticket_links` contiene todas las URLs (incluida la activa).
--
-- Aplicar manualmente en el SQL Editor de Supabase.

ALTER TABLE cms_events
  ADD COLUMN IF NOT EXISTS ticket_links TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: cada evento existente arranca con su URL actual como única entrada.
UPDATE cms_events
  SET ticket_links = ARRAY[tickets]
  WHERE tickets IS NOT NULL AND tickets <> '' AND cardinality(ticket_links) = 0;
