import { RiCoupon3Line } from '@remixicon/react';

// Sello "Descuento Junglist". Los dos colores de marca en una sola marca:
// relleno rosa (#ff0055 = el descuento) + sombra azul (#0000ff = identidad
// junglist). Se reusa en el listado, la landing del evento y el perfil, para que
// el descuento se lea igual en todo el sitio.
// Con `href` se vuelve clickeable (lleva a donde se reclama el descuento: el
// bloque de cupón de la landing). Sirve en server components; el ClickTracker lo
// registra solo como ui_click. Sin href queda como indicador (span).
export default function JunglistDiscountBadge({
  size = 'sm',
  href,
  className = '',
}: {
  size?: 'sm' | 'md';
  href?: string;
  className?: string;
}) {
  const dims =
    size === 'md'
      ? 'px-3 py-1.5 text-sm gap-2 shadow-[4px_4px_0_#0000ff]'
      : 'px-2 py-1 text-[11px] gap-1.5 shadow-[3px_3px_0_#0000ff]';
  const base = `inline-flex items-center border-2 border-black bg-[#ff0055] text-white font-bold uppercase mono tracking-wide ${dims} ${className}`;
  const inner = (
    <>
      <RiCoupon3Line size={size === 'md' ? 18 : 14} aria-hidden />
      Descuento Junglist
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        data-track="Descuento Junglist"
        className={`${base} cursor-pointer transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5`}
      >
        {inner}
      </a>
    );
  }
  return <span className={base}>{inner}</span>;
}
