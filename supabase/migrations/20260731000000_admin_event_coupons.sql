-- Lectura admin de los CÓDIGOS de cupón de un evento. Tras el fix de seguridad
-- (20260730), los códigos ya no son legibles por SELECT normal (ni para admins,
-- porque el grant por columna es por rol, no por is_admin). Esta función
-- SECURITY DEFINER los devuelve SOLO si el llamador es admin — para poblar el
-- formulario de edición del evento y la precarga en la campaña.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

CREATE OR REPLACE FUNCTION admin_event_coupons(p_event_id UUID)
RETURNS TABLE (coupon_junglist_new TEXT, coupon_junglist TEXT, coupon_set_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RETURN; -- no admin → sin filas
  END IF;

  RETURN QUERY
    SELECT e.coupon_junglist_new, e.coupon_junglist, e.coupon_set_at
    FROM cms_events e
    WHERE e.id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_event_coupons(UUID) TO authenticated;
