-- Secciones personalizadas OPCIONALES del presskit: el DJ puede agregar las
-- secciones que quiera (título libre + contenido de texto) que se muestran
-- después de la bio en su presskit público. Array JSONB de { title, body }.
-- Aplicar a mano en el SQL Editor de Supabase (no hay CLI en el repo).
ALTER TABLE presskits ADD COLUMN IF NOT EXISTS custom_sections jsonb NOT NULL DEFAULT '[]'::jsonb;
