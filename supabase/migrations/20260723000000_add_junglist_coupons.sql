-- Descuentos Junglist por evento.
--
-- Los cupones viven en el EVENTO (no en la campaña) porque la landing
-- /evento/[id] los tiene que servir, sobreviven a más de una campaña y también
-- valen para quien llega orgánico. La campaña guarda solo un snapshot de qué
-- mandó, para el historial.
--
-- El código NUNCA viaja en el correo: si viajara, se reenvía y cualquiera lo usa
-- sin inscribirse. El correo solo promete el descuento y linkea a la landing,
-- donde se revela contra sesión + estado de junglist.
--
-- Aplicar manualmente en el SQL Editor de Supabase.

-- ── Cupones del evento ──────────────────────────────────────────────────────
ALTER TABLE cms_events
  ADD COLUMN IF NOT EXISTS coupon_junglist_new TEXT,   -- para quien se inscribe a partir de la campaña
  ADD COLUMN IF NOT EXISTS coupon_junglist     TEXT,   -- para quien ya era junglist
  -- Momento en que se fijaron los cupones (= envío de la campaña). Es el corte
  -- nuevo/antiguo: junglists.created_at > coupon_set_at ⇒ junglist nuevo.
  ADD COLUMN IF NOT EXISTS coupon_set_at TIMESTAMPTZ;

-- ── Snapshot en la campaña (para el historial) ──────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS coupon_mode TEXT,           -- 'none' | 'single' | 'split'
  ADD COLUMN IF NOT EXISTS coupon_new_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_existing_code TEXT;

-- Segmento al que se le envió cada correo: define qué copy recibió.
ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS segment TEXT;               -- 'junglist' | 'no_junglist'

-- ── Cupón del evento para el junglist autenticado ───────────────────────────
-- Devuelve el código que le corresponde al usuario actual, o NULL si no aplica.
-- SECURITY DEFINER para poder leer junglists/pk_profiles sin abrir RLS, pero
-- decide TODO en base a auth.uid(): el llamador no puede pedir el cupón de otro
-- ni saber cuál es el otro código. Un no-junglist recibe NULL.
CREATE OR REPLACE FUNCTION get_event_coupon(p_event_id UUID)
RETURNS TABLE (code TEXT, kind TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new TEXT;
  v_existing TEXT;
  v_cutoff TIMESTAMPTZ;
  v_since TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT coupon_junglist_new, coupon_junglist, coupon_set_at
    INTO v_new, v_existing, v_cutoff
  FROM cms_events WHERE id = p_event_id;

  IF COALESCE(v_new, v_existing) IS NULL THEN
    RETURN;
  END IF;

  -- Un DJ es siempre junglist: vale el registro más antiguo de cualquiera de las
  -- dos tablas. Si no está en ninguna, no es junglist y no hay cupón.
  SELECT MIN(created_at) INTO v_since FROM (
    SELECT created_at FROM junglists   WHERE user_id = v_uid
    UNION ALL
    SELECT created_at FROM pk_profiles WHERE user_id = v_uid
  ) t;

  IF v_since IS NULL THEN
    RETURN;
  END IF;

  -- Cada segmento lee SOLO su columna, sin fallback: el admin elige explícitamente
  -- a quién va el descuento (ambos / solo nuevos / solo ya registrados), y una
  -- columna NULL significa "a este segmento no le corresponde descuento".
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
