export function TrophyIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Trophy cup */}
      <path
        d="M35 20H65V45C65 55 58 65 50 65C42 65 35 55 35 45V20Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
        fill="none"
      />

      {/* Trophy rim */}
      <path
        d="M32 20H68"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.4"
        strokeLinecap="round"
      />

      {/* Left handle */}
      <path
        d="M35 25C35 25 25 25 22 30C19 35 20 42 25 45C30 48 35 45 35 45"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
        fill="none"
      />

      {/* Right handle */}
      <path
        d="M65 25C65 25 75 25 78 30C81 35 80 42 75 45C70 48 65 45 65 45"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
        fill="none"
      />

      {/* Stem */}
      <path
        d="M50 65V75"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
        strokeLinecap="round"
      />

      {/* Base */}
      <path
        d="M40 75H60V78C60 79 59 80 58 80H42C41 80 40 79 40 78V75Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
        fill="none"
      />

      {/* Base plate */}
      <ellipse
        cx="50"
        cy="82"
        rx="18"
        ry="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
        fill="none"
      />

      {/* Star accent */}
      <path
        d="M50 32L52 38L58 38L53 42L55 48L50 44L45 48L47 42L42 38L48 38L50 32Z"
        fill="#19abb5"
        opacity="0.6"
      />

      {/* Sparkles */}
      <circle cx="28" cy="15" r="1.5" fill="#19abb5" opacity="0.5" />
      <circle cx="72" cy="12" r="1" fill="#19abb5" opacity="0.4" />
      <circle cx="80" cy="55" r="1.5" fill="#19abb5" opacity="0.3" />
      <circle cx="20" cy="50" r="1" fill="#19abb5" opacity="0.4" />
    </svg>
  )
}
