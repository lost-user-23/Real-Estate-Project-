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

export function AlertIcon(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.9 18.1A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.9L14.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
