-- Junglists: audiencia de auto-registro voluntario (novedades de eventos / correos).
-- Ligada a auth.users (login con Google). Campos livianos, distintos de pk_profiles.
--
-- Relación con DJs: un DJ (pk_profiles) SIEMPRE se considera junglist, pero vive en
-- su propia tabla (pk_profiles) por sus privilegios/campos. NO se duplica aquí: la
-- audiencia total = junglists ∪ pk_profiles (unión por email), igual que ya hace
-- api/admin/ravers. Un junglist no es necesariamente DJ.

CREATE TABLE IF NOT EXISTS junglists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  instagram TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS junglists_user_id_idx ON junglists(user_id);
CREATE INDEX IF NOT EXISTS junglists_email_idx ON junglists(email);

ALTER TABLE junglists ENABLE ROW LEVEL SECURITY;

-- SELECT: cada junglist ve su propia fila; los admins ven todas.
CREATE POLICY "Junglists can view own row or admin views all" ON junglists
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- INSERT: cada usuario inserta solo su propia fila.
CREATE POLICY "Users can insert own junglist row" ON junglists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: cada usuario edita lo suyo; admins editan cualquiera.
CREATE POLICY "Junglists can update own row or admin any" ON junglists
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- DELETE: baja voluntaria propia; admins borran cualquiera.
CREATE POLICY "Junglists can delete own row or admin any" ON junglists
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- updated_at automático (reutiliza handle_updated_at() definido para profiles).
DROP TRIGGER IF EXISTS junglists_updated_at ON junglists;
CREATE TRIGGER junglists_updated_at
  BEFORE UPDATE ON junglists
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Listas disjuntas: ravers (newsletter_subscribers) = correos importados a mano por
-- admins; junglists = auto-registro voluntario. Si alguien se registra como junglist,
-- se elimina su fila de ravers para que quede en una sola lista.
-- SECURITY DEFINER: corre con privilegios del dueño, así puede borrar de
-- newsletter_subscribers pese a su RLS admin-only (el usuario que se registra no es admin).
CREATE OR REPLACE FUNCTION remove_raver_on_junglist_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM newsletter_subscribers WHERE lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS junglists_dedupe_ravers ON junglists;
CREATE TRIGGER junglists_dedupe_ravers
  AFTER INSERT ON junglists
  FOR EACH ROW EXECUTE FUNCTION remove_raver_on_junglist_insert();
