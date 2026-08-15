/**
 * Nine hand-authored geometric icons. No icon dependency, no Material
 * Symbols path data - every path below is original. Every icon is
 * `aria-hidden`/`focusable={false}`, so every icon-only control that uses
 * one MUST carry its own `aria-label` for the control to remain
 * accessible-name-queryable.
 */
export interface IconProps {
  size?: number;
  className?: string;
}

const BASE_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function IconLive({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.5 5.5a9.5 9.5 0 0 0 0 13" />
      <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
    </svg>
  );
}

export function IconHistory({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconSearch({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19 19l-4-4" />
    </svg>
  );
}

export function IconServer({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <rect x="3.5" y="4" width="17" height="6.5" rx="1.25" />
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.25" />
      <circle cx="7" cy="7.25" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="7" cy="16.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBell({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5h-14S6.5 14 6.5 10Z" />
      <path d="M10.25 18.5a1.9 1.9 0 0 0 3.5 0" />
    </svg>
  );
}

export function IconDownload({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 18.5h15" />
    </svg>
  );
}

export function IconPause({ size = 16, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable={false}
    >
      <rect x="6.5" y="4.5" width="4" height="15" rx="1" />
      <rect x="13.5" y="4.5" width="4" height="15" rx="1" />
    </svg>
  );
}

export function IconPlay({ size = 16, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable={false}
    >
      <path d="M7.5 4.5v15l12-7.5-12-7.5Z" />
    </svg>
  );
}

export function IconArrowDown({ size = 16, className }: IconProps) {
  return (
    <svg {...BASE_PROPS} width={size} height={size} className={className}>
      <path d="M12 4.5v14" />
      <path d="M6.5 13 12 18.5 17.5 13" />
    </svg>
  );
}
