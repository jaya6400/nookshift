export function FloorPlan({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 150"
      className={className}
      role="img"
      aria-label="Illustrative floor plan"
    >
      <rect x="8" y="8" width="204" height="134" rx="6" fill="#DBEAFE" stroke="#1C0770" strokeWidth="2" />
      {/* Door opening */}
      <path d="M8 96 h26" stroke="#0F0A2A" strokeWidth="4" />
      <path d="M34 96 A 26 26 0 0 0 34 122" fill="none" stroke="#3A9AFF" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* Window */}
      <rect x="150" y="8" width="48" height="5" fill="#3A9AFF" />
      {/* Bed */}
      <rect x="20" y="20" width="70" height="42" rx="3" fill="#fff" stroke="#1C0770" strokeWidth="1.5" />
      <rect x="20" y="20" width="16" height="42" rx="3" fill="#fff" stroke="#1C0770" strokeWidth="1.5" />
      {/* Desk near window */}
      <rect x="132" y="24" width="66" height="16" rx="2" fill="#fff" stroke="#1C0770" strokeWidth="1.5" />
      <circle cx="158" cy="52" r="8" fill="#fff" stroke="#1C0770" strokeWidth="1.5" />
      {/* Sofa */}
      <rect x="30" y="86" width="76" height="24" rx="4" fill="#fff" stroke="#1C0770" strokeWidth="1.5" />
      <rect x="30" y="78" width="76" height="10" rx="4" fill="#fff" stroke="#1C0770" strokeWidth="1.5" />
      {/* Plant */}
      <circle cx="190" cy="112" r="9" fill="#F1FF5E" stroke="#1C0770" strokeWidth="1.5" />
      {/* Labels */}
      <text x="42" y="46" fontSize="8" fill="#1C0770" fontWeight="700">BED</text>
      <text x="150" y="35" fontSize="8" fill="#1C0770" fontWeight="700">DESK</text>
      <text x="56" y="101" fontSize="8" fill="#1C0770" fontWeight="700">SOFA</text>
      <text x="184" y="130" fontSize="7" fill="#3A9AFF" fontWeight="700">window</text>
    </svg>
  );
}
