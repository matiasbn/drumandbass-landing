-- Baja voluntaria: NO se borra, se marca como dado de baja. Así se conserva la
-- fecha de registro (created_at) —que importa para el corte de descuento
-- junglist— y nadie puede darse de baja y re-registrarse para resetearla. El
-- re-registro reactiva la misma fila conservando la fecha. El borrado definitivo
-- queda solo para la acción explícita del admin.
--
-- Las campañas ignoran a los dados de baja (unsubscribed_at no nulo).
--
-- Aplicar manualmente en el SQL Editor de Supabase.

-- Junglists: la baja es una opción del perfil (self-service).
ALTER TABLE junglists
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Correos / no registrados: la baja es el link "Darme de baja" del correo.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Marca la baja de un correo desde el link del email (sin sesión). SECURITY
-- DEFINER para saltar la RLS admin-only; marca en ambas tablas por si el correo
-- es junglist y/o está en no registrados. Solo setea unsubscribed_at.
CREATE OR REPLACE FUNCTION mark_unsubscribe(p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE newsletter_subscribers
    SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
    WHERE lower(email) = lower(p_email);
  UPDATE junglists
    SET unsubscribed_at = COALESCE(unsubscribed_at, NOW())
    WHERE lower(email) = lower(p_email);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_unsubscribe(TEXT) TO anon, authenticated;
