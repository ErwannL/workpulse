import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base: P = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const IconPulse = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 12h3.5l2-6 3.5 12 2.5-7 1.6 3h4.9" />
  </svg>
);

export const IconWeek = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="10" width="4" height="10" rx="1.3" />
    <rect x="10" y="5" width="4" height="15" rx="1.3" />
    <rect x="17" y="13" width="4" height="7" rx="1.3" />
  </svg>
);

export const IconCalendar = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconStats = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 19V5" />
    <path d="M4 15.5l5-4.5 4 3 7-7" />
    <path d="M16 7h4v4" />
  </svg>
);

export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6" />
  </svg>
);

export const IconPlay = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 4.8v14.4l12-7.2z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCoffee = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
    <path d="M17 10.5h1.6a2.4 2.4 0 1 1 0 4.8H17" />
    <path d="M8 2.6v2.6M12 2.6v2.6" />
  </svg>
);

export const IconStop = (p: P) => (
  <svg {...base} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconHome = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 11.2 12 4l8.5 7.2" />
    <path d="M5.5 9.8V20h13V9.8" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconEdit = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l1 12.2h9L17 7" />
  </svg>
);

export const IconChevronLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14.5 5 8 12l6.5 7" />
  </svg>
);

export const IconChevronRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 5 16 12l-6.5 7" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
);

export const IconAlert = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 21.5 20h-19z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </svg>
);

export const IconBell = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z" />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" />
  </svg>
);

export const IconDownload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19h14" />
  </svg>
);
