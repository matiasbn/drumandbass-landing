-- Log GENÉRICO de acciones de destinatarios de campaña.
--
-- En vez de agregar una columna por cada acción de cada tipo de campaña (p.ej.
-- coupon_copied_at para campañas de evento), guardamos un log extensible: cada
-- acción es una fila con `action` (el tipo) + `at` (cuándo) + `meta` (jsonb con
-- datos extra opcionales). Un tipo de campaña nuevo registra sus propias acciones
-- sin tocar el esquema. La 'visita' sigue viviendo en campaign_recipients
-- (visited_at) por razones históricas; lo NUEVO va acá.
--
-- Guardamos la PRIMERA vez que cada destinatario hizo cada acción (índice único),
-- así tenemos la fecha/hora sin que se dupliquen clicks repetidos.
--
-- Aplicar manualmente en el SQL Editor de Supabase. Idempotente.

CREATE TABLE IF NOT EXISTS campaign_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_actions_recipient_action
  ON campaign_actions(recipient_id, action);
CREATE INDEX IF NOT EXISTS idx_campaign_actions_action ON campaign_actions(action);

-- Solo admins leen; el registro se hace vía función SECURITY DEFINER (desde anon).
ALTER TABLE campaign_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read campaign_actions" ON campaign_actions;
CREATE POLICY "Admins read campaign_actions" ON campaign_actions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- Registra la primera ocurrencia de una acción de un destinatario (por su id = el
-- ?ct del correo). SECURITY DEFINER: se llama desde anon; solo inserta si el
-- destinatario existe y no repite la misma acción (ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION record_campaign_action(
  p_recipient_id UUID,
  p_action TEXT,
  p_meta JSONB DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO campaign_actions (recipient_id, action, meta)
  SELECT p_recipient_id, p_action, p_meta
  WHERE EXISTS (SELECT 1 FROM campaign_recipients WHERE id = p_recipient_id)
  ON CONFLICT (recipient_id, action) DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION record_campaign_action(UUID, TEXT, JSONB) TO anon, authenticated;
