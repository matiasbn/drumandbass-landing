-- Lectura pública del pendiente POR SLUG, para poder ver el perfil en
-- /artistas/<slug> (rewrite → /pk/<slug>) ANTES de que el DJ lo acepte.
-- pending_presskits es admin-only (RLS); esta función SECURITY DEFINER expone
-- SOLO la data del presskit (que igual será pública al publicarse) de la fila
-- con ese slug y solo si sigue 'pending'. NO expone el email destino.
-- Una vez aceptado (status != 'pending') deja de devolver: ahí ya existe el
-- presskit publicado y la página lo toma de ahí.
CREATE OR REPLACE FUNCTION get_pending_presskit_by_slug(p_slug text)
RETURNS TABLE (slug text, artist_name text, data jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.slug, (pp.data->>'artist_name')::text, pp.data
  FROM pending_presskits pp
  WHERE pp.slug = p_slug AND pp.status = 'pending'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_pending_presskit_by_slug(text) FROM public;
GRANT EXECUTE ON FUNCTION get_pending_presskit_by_slug(text) TO anon, authenticated;
