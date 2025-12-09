export default function SoldBadge({ className = '' }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.35))' }}
      >
        <defs>
          {/* Fundo metálico 3D */}
          <radialGradient id="bg-metal" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#ffcccc" />
            <stop offset="50%" stopColor="#e63939" />
            <stop offset="100%" stopColor="#8b0000" />
          </radialGradient>

          {/* Borda iluminada */}
          <linearGradient id="stroke-light" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>

          {/* Textura leve */}
          <pattern id="noise" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="rgba(0,0,0,0.15)" />
            <circle cx="1" cy="1" r="0.6" fill="rgba(255,255,255,0.25)" />
            <circle cx="3" cy="2" r="0.7" fill="rgba(255,255,255,0.15)" />
          </pattern>
        </defs>

        {/* Selo circular */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="url(#bg-metal)"
          stroke="url(#stroke-light)"
          strokeWidth="4"
        />

        {/* Textura */}
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="url(#noise)"
          opacity="0.25"
        />

        {/* Efeito brilho superior */}
        <ellipse
          cx="80"
          cy="50"
          rx="55"
          ry="22"
          fill="white"
          opacity="0.18"
        />

        {/* Faixa diagonal */}
        <rect
          x="-20"
          y="65"
          width="200" 
          height="32"
          transform="rotate(-20 80 80)"
          fill="rgba(0,0,0,0.35)"
          rx="6"
        />

        {/* Texto "VENDIDO" estilizado */}
        <text
          x="80"
          y="90"
          textAnchor="middle"
          fontSize="34"
          fontWeight="900"
          fill="white"
          transform="rotate(-20 80 80)"
          style={{
            letterSpacing: '3px',
            textShadow: '0 2px 6px rgba(0,0,0,0.45)'
          }}
        >
          VENDIDO
        </text>

        {/* Sombra externa suave */}
        <circle
          cx="80"
          cy="80"
          r="72"
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="6"
          style={{ filter: 'blur(4px)' }}
        />
      </svg>
    </div>
  );
}
