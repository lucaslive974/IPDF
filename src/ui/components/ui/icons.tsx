import type { SVGProps } from 'react';

export function SearchIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Search</title>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13 13 4 4" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Plus</title>
      <path d="M10 4.5v11M4.5 10h11" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Sun</title>
      <circle cx="10" cy="10" r="3.75" />
      <path
        d="M10 2.5v1.5m0 12v1.5M2.5 10H4m12 0h1.5m-2.73-5.27 1.06-1.06M5.67 14.33l1.06-1.06m0-6.54L5.67 5.67m8.66 8.66 1.06 1.06"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Moon</title>
      <path d="M16.5 12.8A7.2 7.2 0 0 1 7.2 3.5a7.2 7.2 0 1 0 9.3 9.3Z" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Settings</title>
      <path d="M3 6.5h14M3 13.5h14M7 4.5v4m6 3v4" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Arrow Left</title>
      <path d="m12.5 15-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Close</title>
      <path d="m6 6 8 8m0-8-8 8" strokeLinecap="round" />
    </svg>
  );
}

export function BookIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Book</title>
      <path
        d="M3.75 15.5A2.25 2.25 0 0 1 6 13.25h10.25V4.75H6a2.25 2.25 0 0 0-2.25 2.25v8.5Z"
        strokeLinejoin="round"
      />
      <path d="M3.75 15.5A2.25 2.25 0 0 0 6 17.75h10.25" strokeLinecap="round" />
    </svg>
  );
}

export function SparklesIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Sparkles</title>
      <path
        d="M10 2.5 11.8 7.2l4.7 1.8-4.7 1.8L10 15.5l-1.8-4.7-4.7-1.8 4.7-1.8L10 2.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Globe</title>
      <circle cx="10" cy="10" r="7" />
      <path
        d="M3 10h14M10 3a10.5 10.5 0 0 1 0 14 10.5 10.5 0 0 1 0-14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Copy</title>
      <rect x="7" y="7" width="9.5" height="9.5" rx="2" strokeLinejoin="round" />
      <path
        d="M5 12.5H4a1.75 1.75 0 0 1-1.75-1.75V4a1.75 1.75 0 0 1 1.75-1.75h6.75A1.75 1.75 0 0 1 12 4v1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TrashIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Trash</title>
      <path
        d="M4 5.5h12m-9.5 0V4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v1.5m-7.5 0v9.75a1.75 1.75 0 0 0 1.75 1.75h4.5a1.75 1.75 0 0 0 1.75-1.75V5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PencilIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Edit</title>
      <path
        d="m14.2 3.8 2 2-9.7 9.7H4.5v-2l9.7-9.7ZM12.7 5.3l2 2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Check</title>
      <path d="m4.5 10 3.5 3.5 7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Arrow Right</title>
      <path d="m7.5 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon({ className = 'h-4 w-4', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      {...props}
    >
      <title>Chevron Down</title>
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
