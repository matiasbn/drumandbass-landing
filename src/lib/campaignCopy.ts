// Copy segmentado de las campañas de evento.
//
// El correo depende del estado de registro del destinatario: a quien ya es
// junglist se le avisa que su descuento lo espera; a quien no lo es, que se
// inscriba para acceder al suyo. Si a un segmento no le corresponde descuento,
// su correo NO lo menciona (asunto y cuerpo quedan como recordatorio del evento).
//
// Este módulo lo usan tanto el envío (api/admin/campaigns) como la vista previa
// del admin, para que lo que se previsualiza sea exactamente lo que se manda.

export type CouponTarget = 'both' | 'new_only' | 'existing_only';
export type Segment = 'junglist' | 'no_junglist';

export interface CouponConfig {
  enabled: boolean;
  /** A quién le corresponde el descuento. */
  target: CouponTarget;
  /** Solo aplica con target 'both': un mismo código o uno por segmento. */
  sameForAll: boolean;
  newCode: string;
  existingCode: string;
}

/**
 * Códigos finales por segmento. Sin fallback entre segmentos: vacío significa
 * "a este segmento no le corresponde descuento".
 * - `newCode` → lo verá quien se inscriba a partir de esta campaña (no junglist).
 * - `existingCode` → lo verá quien ya era junglist.
 */
export function resolveCoupon(c: CouponConfig): { newCode: string; existingCode: string } {
  if (!c.enabled) return { newCode: '', existingCode: '' };
  const rawNew = c.newCode.trim();
  const rawExisting = c.existingCode.trim();

  if (c.target === 'new_only') return { newCode: rawNew, existingCode: '' };
  if (c.target === 'existing_only') return { newCode: '', existingCode: rawExisting };
  if (c.sameForAll) {
    const code = rawNew || rawExisting;
    return { newCode: code, existingCode: code };
  }
  return { newCode: rawNew, existingCode: rawExisting };
}

/** Si al segmento le corresponde descuento (y por tanto se le menciona). */
export function segmentHasCoupon(
  segment: Segment,
  codes: { newCode: string; existingCode: string }
): boolean {
  return segment === 'junglist' ? Boolean(codes.existingCode) : Boolean(codes.newCode);
}

const COUPON_PARAGRAPH: Record<Segment, string> = {
  junglist:
    '<p><strong>Por ser Junglist tienes un descuento para este evento.</strong> Entra al link de abajo e inicia sesión para ver tu código.</p>',
  no_junglist:
    '<p><strong>Inscríbete gratis como Junglist y accede a tu descuento para este evento.</strong> Entra al link de abajo, te toma un minuto.</p>',
};

/** Cuerpo del correo para el segmento: el base, más el párrafo del descuento si aplica. */
export function segmentBody(baseBody: string, segment: Segment, hasCoupon: boolean): string {
  return hasCoupon ? `${baseBody}${COUPON_PARAGRAPH[segment]}` : baseBody;
}

/**
 * Asunto del correo. Con descuento anuncia el descuento; sin descuento queda el
 * asunto de la campaña (que la plantilla pre-rellena como "Nos vemos en …").
 */
export function segmentSubject(baseSubject: string, eventTitle: string, hasCoupon: boolean): string {
  return hasCoupon ? `Descuento Junglist para ${eventTitle}` : baseSubject;
}

export const SEGMENT_LABELS: Record<Segment, string> = {
  junglist: 'Junglists y DJs',
  no_junglist: 'Aún no son Junglists',
};
