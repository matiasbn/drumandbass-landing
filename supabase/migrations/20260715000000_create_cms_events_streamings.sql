-- CMS propio (reemplazo de Contentful): eventos y streamings viven en Supabase
-- y se administran desde /admin/eventos y /admin/streamings.
--
-- Las fechas se guardan como TEXT en formato 'YYYY-MM-DDTHH:mm' (hora local de
-- Chile), exactamente el mismo formato que entregaba Contentful. Todo el
-- pipeline (dayjs, badges de proximidad, filtro de pasados, event_date de GA)
-- ya asume ese formato; usar timestamptz introduciría corrimientos de zona
-- horaria. El orden lexicográfico de ISO-8601 coincide con el cronológico.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

-- ── Eventos ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cms_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT,
  address TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  -- Lineup/descripción como HTML (editor tiptap en el admin). Reemplaza al
  -- rich text de Contentful, que se renderizaba a HTML de todos modos.
  description_html TEXT,
  tickets TEXT,
  info TEXT,
  -- Flyer subido al bucket público 'flyers'. Ancho/alto se capturan al subir
  -- porque next/image los necesita.
  flyer_url TEXT,
  flyer_width INTEGER,
  flyer_height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS cms_events_date_idx ON cms_events(date);

ALTER TABLE cms_events ENABLE ROW LEVEL SECURITY;

-- Contenido público: cualquiera (incluido anon) puede leer.
CREATE POLICY "Anyone can view cms events" ON cms_events
  FOR SELECT USING (true);

-- Escritura solo para admins.
CREATE POLICY "Admins can insert cms events" ON cms_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update cms events" ON cms_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete cms events" ON cms_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

DROP TRIGGER IF EXISTS cms_events_updated_at ON cms_events;
CREATE TRIGGER cms_events_updated_at
  BEFORE UPDATE ON cms_events
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── Streamings ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cms_streamings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  date TEXT NOT NULL,
  end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS cms_streamings_date_idx ON cms_streamings(date);

ALTER TABLE cms_streamings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cms streamings" ON cms_streamings
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert cms streamings" ON cms_streamings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update cms streamings" ON cms_streamings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete cms streamings" ON cms_streamings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

DROP TRIGGER IF EXISTS cms_streamings_updated_at ON cms_streamings;
CREATE TRIGGER cms_streamings_updated_at
  BEFORE UPDATE ON cms_streamings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── Storage: bucket público 'flyers' ───────────────────────────────────────
-- Los flyers se sirven directo desde el bucket (público, como pk-photos).
-- Solo admins pueden subir/reemplazar/borrar.

INSERT INTO storage.buckets (id, name, public)
VALUES ('flyers', 'flyers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read flyers" ON storage.objects
  FOR SELECT USING (bucket_id = 'flyers');

CREATE POLICY "Admins upload flyers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'flyers'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins update flyers" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'flyers'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins delete flyers" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'flyers'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );
