-- Copias del código de descuento, trackeadas por EVENTO + USUARIO (no por campaña).
--
-- El cupón vive en el evento, y para copiarlo hay que estar logueado como junglist
-- → siempre sabemos quién es (auth.uid()). Así el tracking no depende del ?ct de
-- una campaña: registra que "este usuario copió el código de este evento", venga
-- de una campaña, de otra, o de forma orgánica. Una fila por (evento, usuario).
--
-- Reemplaza al uso de campaign_actions.coupon_copy (que era por destinatario de
-- campaña). El admin de campaña cruza por email para mostrar "Copió código" sin
-- importar la vía.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS event_coupon_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES cms_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  copied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_coupon_copies_event ON event_coupon_copies(event_id);
CREATE INDEX IF NOT EXISTS idx_event_coupon_copies_email ON event_coupon_copies(lower(email));

-- Solo admins leen; el registro se hace vía función SECURITY DEFINER.
ALTER TABLE event_coupon_copies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read event_coupon_copies" ON event_coupon_copies;
CREATE POLICY "Admins read event_coupon_copies" ON event_coupon_copies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- Registra la copia del código por el usuario logueado (auth.uid()). Guarda la
-- primera vez por (evento, usuario). El email se resuelve de auth.users para poder
-- cruzarlo con los destinatarios de campaña (que se llevan por email).
CREATE OR REPLACE FUNCTION record_coupon_copy(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  INSERT INTO event_coupon_copies (event_id, user_id, email)
  VALUES (p_event_id, v_uid, v_email)
  ON CONFLICT (event_id, user_id) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION record_coupon_copy(UUID) TO authenticated;
