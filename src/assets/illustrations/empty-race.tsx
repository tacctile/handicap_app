export function EmptyRaceIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Horse silhouette - minimal and elegant */}
      <g opacity="0.3">
        {/* Body */}
        <path
          d="M60 90C60 90 65 70 85 65C105 60 115 55 125 60C135 65 145 75 150 85C155 95 155 105 150 110C145 115 135 115 125 112C115 109 105 105 95 105C85 105 75 108 65 110C55 112 50 105 55 95C60 85 60 90 60 90Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Head */}
        <path
          d="M55 95C55 95 45 90 40 85C35 80 30 75 28 70C26 65 30 60 35 60C40 60 50 65 55 75"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Ear */}
        <path
          d="M35 60C35 60 32 52 35 48C38 44 42 48 42 52"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Mane */}
        <path
          d="M55 75C55 75 65 68 75 68C85 68 90 72 90 72"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Front legs */}
        <path
          d="M95 105L95 130M105 105L105 128"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Back legs */}
        <path
          d="M135 110L140 130M145 108L152 128"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Tail */}
        <path
          d="M150 85C150 85 165 88 170 95C175 102 172 108 165 108"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </g>

      {/* Decorative elements */}
      <circle cx="30" cy="30" r="3" fill="currentColor" opacity="0.2" />
      <circle cx="170" cy="40" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="180" cy="130" r="2" fill="currentColor" opacity="0.2" />
      <circle cx="20" cy="120" r="2.5" fill="currentColor" opacity="0.15" />

      {/* Ground line */}
      <line x1="20" y1="140" x2="180" y2="140" stroke="currentColor" opacity="0.1" strokeWidth="1" strokeDasharray="4 4" />
    </svg>
  )
}
