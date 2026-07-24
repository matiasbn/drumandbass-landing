-- Modelo padre/hija de campañas: los reenvíos ("· Reenvío N") apuntan a su
-- campaña RAÍZ vía parent_campaign_id. Así el botón "insistir" targetea a quien no
-- interactuó con TODA la línea (original + reenvíos), no solo con la campaña
-- actual. La raíz tiene parent NULL; las hijas son hermanas que apuntan todas a la
-- misma raíz. ON DELETE SET NULL: si se borra la raíz, las hijas quedan sueltas.
--
-- (El "primer click" por campaña NO se guarda: es derivable — MIN(visited_at) de
-- sus destinatarios — y se calcula al vuelo en el detalle, donde ya se cargan.)
--
-- Aplicar manualmente en el SQL Editor de Supabase. Idempotente.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS parent_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_parent ON campaigns(parent_campaign_id);
