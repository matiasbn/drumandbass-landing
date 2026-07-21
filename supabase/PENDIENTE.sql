-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT PENDIENTE DE APLICAR EN SUPABASE (SQL Editor)
--
-- Consolida lo que falta de las migraciones 20260722 (tracking de campañas) y
-- 20260723 (descuentos Junglist). Es idempotente: todo usa IF NOT EXISTS o
-- CREATE OR REPLACE, así que se puede correr aunque parte ya esté aplicada.
--
-- Cuando esté corrido, este archivo se puede borrar: la fuente de verdad son
-- supabase/migrations/ y supabase-schema.sql.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1) TRACKING DE CAMPAÑAS (pendiente de 20260722)
--
-- El id (uuid) de cada fila de campaign_recipients viaja en el link del correo
-- (?ct=<id>) y en el pixel de apertura. Estas funciones son SECURITY DEFINER
-- para que el registro se pueda hacer desde anon, sin service-role: solo tocan
-- la fila cuyo id coincide y no devuelven nada.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS visited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segment TEXT;   -- 'junglist' | 'no_junglist'

CREATE OR REPLACE FUNCTION mark_campaign_visit(p_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE campaign_recipients
  SET visited_at = COALESCE(visited_at, NOW()),
      visit_count = visit_count + 1,
      status = CASE WHEN status IN ('sent','delivered','opened') THEN 'clicked' ELSE status END
  WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION mark_campaign_visit(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION mark_campaign_open(p_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE campaign_recipients
  SET opened_at = COALESCE(opened_at, NOW()),
      status = CASE WHEN status IN ('sent','delivered') THEN 'opened' ELSE status END
  WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION mark_campaign_open(UUID) TO anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 2) DESCUENTOS JUNGLIST (20260723)
--
-- Los cupones viven en el EVENTO (no en la campaña): la landing /evento/[id]
-- los tiene que servir, sobreviven a más de una campaña y también valen para
-- quien llega orgánico. La campaña guarda solo un snapshot para el historial.
--
-- El código NUNCA viaja en el correo: si viajara, se reenvía y cualquiera lo usa
-- sin inscribirse. El correo solo anuncia el descuento y linkea a la landing,
-- donde se revela contra sesión + estado de junglist.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE cms_events
  ADD COLUMN IF NOT EXISTS coupon_junglist_new TEXT,   -- se inscribe a partir de la campaña
  ADD COLUMN IF NOT EXISTS coupon_junglist     TEXT,   -- ya era junglist
  -- Corte nuevo/antiguo: junglists.created_at > coupon_set_at ⇒ junglist nuevo.
  ADD COLUMN IF NOT EXISTS coupon_set_at TIMESTAMPTZ;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS coupon_mode TEXT,   -- none | both_same | both_split | new_only | existing_only
  ADD COLUMN IF NOT EXISTS coupon_new_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_existing_code TEXT;

-- Devuelve el cupón que le corresponde al usuario actual, o nada.
-- SECURITY DEFINER, pero decide TODO en base a auth.uid(): el llamador no puede
-- pedir el cupón de otro ni descubrir el código del otro segmento. Un usuario
-- que no es junglist recibe vacío.
CREATE OR REPLACE FUNCTION get_event_coupon(p_event_id UUID)
RETURNS TABLE (code TEXT, kind TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new TEXT;
  v_existing TEXT;
  v_cutoff TIMESTAMPTZ;
  v_since TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT coupon_junglist_new, coupon_junglist, coupon_set_at
    INTO v_new, v_existing, v_cutoff
  FROM cms_events WHERE id = p_event_id;

  IF COALESCE(v_new, v_existing) IS NULL THEN RETURN; END IF;

  -- Un DJ es siempre junglist: vale el registro más antiguo de cualquiera de las
  -- dos tablas. Si no está en ninguna, no es junglist y no hay cupón.
  SELECT MIN(created_at) INTO v_since FROM (
    SELECT created_at FROM junglists   WHERE user_id = v_uid
    UNION ALL
    SELECT created_at FROM pk_profiles WHERE user_id = v_uid
  ) t;

  IF v_since IS NULL THEN RETURN; END IF;

  -- Cada segmento lee SOLO su columna, sin fallback: el admin elige explícitamente
  -- a quién va el descuento, y una columna NULL significa "a este segmento no le
  -- corresponde".
  IF v_cutoff IS NOT NULL AND v_since > v_cutoff THEN
    IF v_new IS NULL THEN RETURN; END IF;
    RETURN QUERY SELECT v_new, 'new'::TEXT;
  ELSE
    IF v_existing IS NULL THEN RETURN; END IF;
    RETURN QUERY SELECT v_existing, 'existing'::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_coupon(UUID) TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- NOTA: get_event_coupon asume que pk_profiles tiene las columnas user_id y
-- created_at. pk_profiles no está versionada en el repo (se creó a mano), así
-- que si el CREATE FUNCTION falla con "column created_at does not exist",
-- avisar para resolver los DJs por otra vía.
-- ───────────────────────────────────────────────────────────────────────────
