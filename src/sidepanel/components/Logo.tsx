/** The Sanjob mark (same drawing as public/icons/icon.svg). */
export function Logo(props: { class?: string }) {
  return (
    <svg viewBox="0 0 128 128" class={props.class} aria-hidden="true">
      <defs>
        <linearGradient id="sanjob-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#14b8a6" />
          <stop offset="1" stop-color="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#sanjob-logo-bg)" />
      <path
        d="M47 36v-7a7 7 0 0 1 7-7h20a7 7 0 0 1 7 7v7"
        fill="none"
        stroke="#ffffff"
        stroke-width="9"
        stroke-linecap="round"
      />
      <rect x="18" y="36" width="92" height="70" rx="13" fill="#ffffff" />
      <rect x="31" y="51" width="66" height="9" rx="4.5" fill="#0f766e" />
      <rect x="31" y="67" width="66" height="9" rx="4.5" fill="#14b8a6" />
      <rect x="31" y="83" width="40" height="9" rx="4.5" fill="#f59e0b" />
    </svg>
  );
}
