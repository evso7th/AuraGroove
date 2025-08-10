import type { SVGProps } from "react";

export default function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      aria-label="AuraGroove Logo"
      {...props}
    >
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>
      <path
        fill="url(#grad1)"
        d="M50,5 C74.85,5 95,25.15 95,50 C95,74.85 74.85,95 50,95 C25.15,95 5,74.85 5,50 C5,25.15 25.15,5 50,5 Z M50,15 C30.67,15 15,30.67 15,50 C15,69.33 30.67,85 50,85 C69.33,85 85,69.33 85,50 C85,30.67 69.33,15 50,15 Z"
      />
      <path
        fill="hsl(var(--foreground))"
        d="M35,65 L30,65 L40,35 L45,35 L55,65 L50,65 L47.5,57.5 L37.5,57.5 Z M40,50 L45,50 L42.5,42.5 Z M60,65 L60,35 L75,35 L75,42.5 L67.5,42.5 L67.5,47.5 L75,47.5 L75,55 L67.5,55 L67.5,65 Z"
      />
    </svg>
  );
}
