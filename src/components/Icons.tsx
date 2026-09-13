/**
 * The bar's icons, drawn rather than typed. Text glyphs such as ⟲ and ? come out in a
 * different font, weight and size on every platform, and sat beside drawn icons that did
 * not. All of these share `.btn-icon svg` for size and stroke.
 */

/** The reveal ring's toggle: an open eye while the ring is shown, struck through when not. */
export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {!open && <path d="M4.5 4.5l15 15" />}
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12a7 7 0 1 0 2.05-4.95" />
      <path d="M5 4.5v3.8h3.8" />
    </svg>
  );
}

export function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.35-1.2.95-1.2 1.8v.3" />
      <path d="M12 17.4v.2" />
    </svg>
  );
}
