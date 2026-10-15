function base(props) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function HeartIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 20.5s-7-4.35-9.5-8.5C.8 8.8 2.2 5 6 5c2 0 3.4 1.1 4 2 .6-.9 2-2 4-2 3.8 0 5.2 3.8 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5Z" />
    </svg>
  );
}

export function HeartFilledIcon(props) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M12 20.5s-7-4.35-9.5-8.5C.8 8.8 2.2 5 6 5c2 0 3.4 1.1 4 2 .6-.9 2-2 4-2 3.8 0 5.2 3.8 3.5 7-2.5 4.15-9.5 8.5-9.5 8.5Z" />
    </svg>
  );
}

export function SearchIcon(props) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function MenuIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function CheckBadgeIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M9 12.5 11 14.5 15.5 10" />
      <path d="M12 3.5c1 0 1.9.6 2.3 1.5.9-.4 2 0 2.6.8.6.8.6 1.9 0 2.7.9.5 1.4 1.4 1.3 2.4-.1 1-.8 1.8-1.7 2 .1 1-.4 1.9-1.3 2.4-.9.5-1.9.3-2.6-.3-.6.7-1.5 1-2.4.8-.9.2-1.8-.1-2.4-.8-.7.6-1.7.8-2.6.3-.9-.5-1.4-1.4-1.3-2.4-.9-.2-1.6-1-1.7-2-.1-1 .4-1.9 1.3-2.4-.6-.8-.6-1.9 0-2.7.6-.8 1.7-1.2 2.6-.8.4-.9 1.3-1.5 2.3-1.5Z" />
    </svg>
  );
}

export function StarIcon(props) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 2.5l2.9 6.2 6.6.6-5 4.6 1.5 6.6L12 17l-5.9 3.5 1.5-6.6-5-4.6 6.6-.6L12 2.5Z" />
    </svg>
  );
}

export function MapPinIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s7-6.6 7-11.5A7 7 0 0 0 5 9.5C5 14.4 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function PlayIcon(props) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function PauseIcon(props) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}

export function CalculatorIcon(props) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 14.5h.01M12 14.5h.01M16 14.5h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}

export function TrendingUpIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function AlertIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.9 18.1A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.9L14.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export function KeyIcon(props) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="15" r="4.5" />
      <path d="m11.2 11.8 8.3-8.3M17 4l2.5 2.5M14.3 6.7l2.3 2.3" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="3" width="9" height="18" rx="1" />
      <path d="M14 8.5h5v12.5h-5M8 7h1M11 7h1M8 10.5h1M11 10.5h1M8 14h1M11 14h1" />
    </svg>
  );
}

// Chat bubble with a small roof inside: the Property Finder launcher.
export function ChatHomeIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.7 8.7 0 0 1-3.6-.8L3.5 21l1.8-4.8A8.1 8.1 0 0 1 4 11.5C4 6.9 7.8 3.2 12.5 3.2S21 6.9 21 11.5Z" />
      <path d="m9 12.2 3.5-3 3.5 3M10 11.6v3h5v-3" />
    </svg>
  );
}
