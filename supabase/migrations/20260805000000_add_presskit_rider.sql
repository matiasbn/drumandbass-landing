-- Rider técnico OPCIONAL del presskit: requerimientos de equipo del DJ
-- (CDJs, mixer, monitores, etc.). Texto libre; se muestra como sección en el
-- presskit público solo si está completo.
-- Aplicar a mano en el SQL Editor de Supabase (no hay CLI en el repo).
ALTER TABLE presskits ADD COLUMN IF NOT EXISTS rider text;
