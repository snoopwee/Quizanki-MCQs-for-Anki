/**
 * Google's own "G", in Google's own four colours.
 *
 * <p>Deliberately NOT in `components/ui/icons.tsx`, and deliberately not restyled to match it.
 * That set is one house style — monochrome, `fill="none"`, 1.8px stroke on a 24px grid — and the
 * rule is that everything joins it. This is the documented exception: it is a third party's
 * trademark, and Google's branding terms require the mark be shown as issued, so recolouring it to
 * terracotta or redrawing it as strokes is not ours to do. Keeping it out of the icon set is what
 * stops it being "fixed" into the house style later.
 *
 * <p>Sized in rem via the `size` prop so it scales with the Text size setting like `Icon` does.
 */
export function GoogleMark({ size = 18 }: { size?: number }) {
  const rem = `${size / 16}rem`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={rem}
      height={rem}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.1C6.22 6.87 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
