-- Guarda lo que REALMENTE se envió por segmento, para que el reenvío a los que
-- fallaron (cuota de Resend) replique EXACTO el correo original —incluidos los
-- textos editados a mano por segmento, que antes vivían solo en localStorage y
-- se perdían—. Sin esto, el reenvío regenera desde el template y podría diferir
-- de lo que recibió el resto.
--
-- Forma: { "junglist": { "subject": "...", "body": "<html>" },
--          "no_junglist": { "subject": "...", "body": "<html>" } }
--
-- Retrocompatible: las campañas viejas quedan con NULL y el reenvío cae al
-- fallback (regenerar desde body_html + cupón), que es determinista.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS segment_content JSONB;
