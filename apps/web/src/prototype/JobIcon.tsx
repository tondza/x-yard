import type { PrototypeJobIcon } from '@x-yard/game-core';

const GLYPH: Readonly<Record<PrototypeJobIcon, readonly string[]>> = {
  barrel: [
    'M4 4 Q8 2 12 4 L12 12 Q8 14 4 12 Z',
    'M4 6 H12',
    'M4 10 H12',
    'M8 2.5 V13.5',
  ],
  bag: [
    'M4.5 6 H11.5 L12 13 H4 Z',
    'M6 6 V4.5 A2 2 0 0 1 10 4.5 V6',
    'M7.5 8.5 H8.5',
  ],
  ledger: ['M4 2.5 H12 V13.5 H4 Z', 'M6 5.5 H10', 'M6 8 H10', 'M6 10.5 H9'],
  case: ['M3 5.5 H13 V13 H3 Z', 'M6 5.5 V3.5 H10 V5.5', 'M3 8.5 H13', 'M8 8 V10'],
  box: ['M8 2 L14 5 V11 L8 14 L2 11 V5 Z', 'M2 5 L8 8 L14 5', 'M8 8 V14'],
  pouch: [
    'M4 6 H12 L11 13.5 H5 Z',
    'M6 6 Q8 3 10 6',
    'M8 3 V1.5',
    'M5.5 9.5 H10.5',
  ],
  carton: ['M4 2.5 H12 V13.5 H4 Z', 'M4 5.5 H12', 'M8 5.5 V13.5', 'M10 8 H11.5'],
  silk: [
    'M3 6.5 H9 V10.5 H3 Z',
    'M7 8 H13 V12 H7 Z',
    'M3 8.5 H9',
    'M7 10.5 H13',
  ],
};

/** The 16×16 shipment glyph used by both the jobs panel and the map badge. */
export function JobGlyph({ icon }: { readonly icon: PrototypeJobIcon }): React.JSX.Element {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPH[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

export function JobIcon({
  icon,
  size = 18,
  className,
}: {
  readonly icon: PrototypeJobIcon;
  readonly size?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <JobGlyph icon={icon} />
    </svg>
  );
}
