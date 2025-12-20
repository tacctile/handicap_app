export function UploadDocumentIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Document background */}
      <rect
        x="25"
        y="15"
        width="60"
        height="80"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
        fill="none"
      />

      {/* Document fold corner */}
      <path
        d="M65 15V30C65 31.6569 66.3431 33 68 33H85"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
        fill="none"
      />
      <path
        d="M65 15L85 33"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
        fill="none"
      />

      {/* Document lines */}
      <line x1="35" y1="45" x2="65" y2="45" stroke="currentColor" strokeWidth="2" opacity="0.15" strokeLinecap="round" />
      <line x1="35" y1="55" x2="75" y2="55" stroke="currentColor" strokeWidth="2" opacity="0.15" strokeLinecap="round" />
      <line x1="35" y1="65" x2="70" y2="65" stroke="currentColor" strokeWidth="2" opacity="0.15" strokeLinecap="round" />
      <line x1="35" y1="75" x2="55" y2="75" stroke="currentColor" strokeWidth="2" opacity="0.15" strokeLinecap="round" />

      {/* Upload arrow circle */}
      <circle
        cx="75"
        cy="80"
        r="25"
        fill="#0F0F10"
        stroke="#19abb5"
        strokeWidth="2"
      />

      {/* Upload arrow */}
      <path
        d="M75 68V92"
        stroke="#19abb5"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M67 76L75 68L83 76"
        stroke="#19abb5"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Decorative dots */}
      <circle cx="15" cy="60" r="2" fill="currentColor" opacity="0.2" />
      <circle cx="105" cy="35" r="2.5" fill="currentColor" opacity="0.15" />
      <circle cx="100" cy="100" r="2" fill="currentColor" opacity="0.2" />
    </svg>
  )
}
