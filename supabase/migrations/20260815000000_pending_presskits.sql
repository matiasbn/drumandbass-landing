-- Presskits creados por un ADMIN en nombre de un DJ que no usa la plataforma.
-- El admin arma todo el PK (nombre, bio, fotos, socials, mixes, rider, etc.) y
-- pone el email del DJ. Se le manda un correo; el DJ hace login con Google y
-- "reclama" el PK: se confirma que su email calza y se crea su presskit real
-- (pk_profiles + presskits, publicado) con la data del admin.
--
-- Vive sin dueño (sin user_id) hasta el claim: por eso una tabla aparte, no
-- presskits (que se indexa por user_id, que el DJ aún no tiene).
-- Aplicar a mano en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS pending_presskits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  email text NOT NULL,
  slug text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- campos editables del presskit
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'cancelled')),
  created_by uuid,          -- admin que lo creó
  claimed_user_id uuid,     -- DJ que lo reclamó
  claimed_at timestamptz,
  invited_at timestamptz,   -- cuándo se mandó el correo de invitación
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pending_presskits ENABLE ROW LEVEL SECURITY;

-- Solo admins gestionan la tabla directamente. El claim (DJ, no admin) va por los
-- RPC SECURITY DEFINER de abajo, no por acceso directo.
DROP POLICY IF EXISTS "Admins manage pending presskits" ON pending_presskits;
CREATE POLICY "Admins manage pending presskits" ON pending_presskits
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = true));

-- Lectura pública por token (para el preview de la página de claim). Devuelve la
-- data del PK (que igual será pública al publicarse) + el email destino. No expone
-- la tabla entera: solo la fila del token, y solo si sigue pendiente.
CREATE OR REPLACE FUNCTION get_pending_presskit(p_token uuid)
RETURNS TABLE (email text, slug text, artist_name text, status text, data jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.email, pp.slug, (pp.data->>'artist_name')::text, pp.status, pp.data
  FROM pending_presskits pp
  WHERE pp.claim_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_pending_presskit(uuid) FROM public;
GRANT EXECUTE ON FUNCTION get_pending_presskit(uuid) TO anon, authenticated;

-- Marca el pendiente como reclamado. Lo llama el endpoint de claim DESPUÉS de
-- crear el presskit real (con la sesión del DJ, que puede insertar sus propias
-- filas por RLS). SECURITY DEFINER porque la tabla es admin-only. Guarda el
-- user_id que reclama y solo actúa si sigue pendiente.
CREATE OR REPLACE FUNCTION mark_pending_presskit_claimed(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  UPDATE pending_presskits
  SET status = 'claimed', claimed_user_id = v_uid, claimed_at = now(), updated_at = now()
  WHERE claim_token = p_token AND status = 'pending';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION mark_pending_presskit_claimed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION mark_pending_presskit_claimed(uuid) TO authenticated;
