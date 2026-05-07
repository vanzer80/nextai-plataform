/** Convert #rrggbb to OKLch components using the official OKLab matrices. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;

  const sr = parseInt(m[1], 16) / 255;
  const sg = parseInt(m[2], 16) / 255;
  const sb = parseInt(m[3], 16) / 255;

  // Inverse sRGB gamma (linearise)
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

  const r = lin(sr), g = lin(sg), b = lin(sb);

  // Linear sRGB → LMS (Björn Ottosson's OKLab matrices)
  const lms_l  = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const lms_m  = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const lms_s  = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(lms_l);
  const m_ = Math.cbrt(lms_m);
  const s_ = Math.cbrt(lms_s);

  // LMS^(1/3) → OKLab
  const L  =  0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a  =  1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bv =  0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // OKLab → OKLch
  const C = Math.sqrt(a * a + bv * bv);
  const H = (Math.atan2(bv, a) * 180) / Math.PI;

  return { l: L, c: C, h: H < 0 ? H + 360 : H };
}

const STYLE_ID = 'tenant-brand';

/**
 * Injects a <style> tag that overrides the primary colour tokens for both
 * light and dark modes, preserving the design system's luminance levels
 * (0.52 light / 0.72 dark) so contrast ratios remain stable.
 *
 * Pass null to remove the override and restore theme defaults.
 */
export function applyTenantBrand(primaryColor: string | null): void {
  const existing = document.getElementById(STYLE_ID);

  if (!primaryColor) {
    existing?.remove();
    return;
  }

  const oklch = hexToOklch(primaryColor);
  if (!oklch) {
    existing?.remove();
    return;
  }

  const { c, h } = oklch;

  // Lock luminance to design-system values; inherit hue and chroma from brand.
  // Dark mode uses 86 % of chroma (same ratio as design-system defaults 0.19 / 0.22).
  const light = `oklch(0.52 ${c.toFixed(3)} ${h.toFixed(1)})`;
  const dark  = `oklch(0.72 ${(c * 0.86).toFixed(3)} ${h.toFixed(1)})`;

  const css =
    `:root{--primary:${light};--ring:${light};--sidebar-primary:${light};--sidebar-ring:${light}}` +
    `.dark{--primary:${dark};--ring:${dark};--sidebar-primary:${dark};--sidebar-ring:${dark}}`;

  const el: HTMLStyleElement =
    (existing as HTMLStyleElement | null) ?? document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
}
