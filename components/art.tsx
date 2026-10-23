// Ilustraciones propias en el estilo de digit.asu.edu: siluetas grises sobre fondo
// oscuro, con estrellas de colores y destellos blancos.

const STAR_POINTS = "0,-10 2.9,-4 9.5,-3.1 4.7,1.5 5.9,8.1 0,5 -5.9,8.1 -4.7,1.5 -9.5,-3.1 -2.9,-4";

export function Star({ x, y, size = 1, color, rotate = 0 }: { x: number; y: number; size?: number; color: string; rotate?: number }) {
  return (
    <polygon
      points={STAR_POINTS}
      fill={color}
      strokeLinejoin="round"
      stroke={color}
      strokeWidth={1.5}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size})`}
    />
  );
}

function Sparkle({ x, y, r = 2 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="#fff" />;
}

function Tree({ x, base, h, color }: { x: number; base: number; h: number; color: string }) {
  const w = h * 0.32;
  return (
    <g>
      <path d={`M${x} ${base - h} C${x + w} ${base - h * 0.7} ${x + w} ${base - h * 0.25} ${x} ${base - h * 0.2} C${x - w} ${base - h * 0.25} ${x - w} ${base - h * 0.7} ${x} ${base - h}Z`} fill={color} />
      <rect x={x - 1} y={base - h * 0.35} width={2} height={h * 0.35} fill="#3a3a3d" />
    </g>
  );
}

export function Rocket({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g transform="rotate(40 100 100)">
        <path d="M84 138 Q100 198 116 138Z" fill="#ff7f32" />
        <path d="M91 138 Q100 176 109 138Z" fill="#ffc845" />
        <rect x="82" y="128" width="36" height="12" rx="4" fill="#6b3fc4" />
        <path d="M76 96 L48 132 L50 150 L80 128Z" fill="#d81b4a" />
        <path d="M124 96 L152 132 L150 150 L120 128Z" fill="#d81b4a" />
        <path d="M100 14 C128 40 134 88 126 130 L74 130 C66 88 72 40 100 14Z" fill="#a970ff" />
        <path d="M100 14 C114 27 122 44 126 62 L114 62 C112 44 107 28 100 14Z" fill="#c4a0ff" />
        <circle cx="100" cy="76" r="17" fill="#c9b6ff" stroke="#7a45e0" strokeWidth="5" />
        <circle cx="100" cy="76" r="9" fill="#f1ebff" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <circle key={a} cx={100 + 13.5 * Math.cos((a * Math.PI) / 180)} cy={76 + 13.5 * Math.sin((a * Math.PI) / 180)} r="1.6" fill="#7a45e0" />
        ))}
        <rect x="96" y="112" width="8" height="34" rx="3" fill="#b0173e" />
      </g>
    </svg>
  );
}

export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg viewBox="0 0 420 620" className="absolute right-0 top-0 h-[70vh] max-h-[620px] w-auto opacity-90">
        <path d="M150 0 C160 70 230 120 268 210 C300 290 296 400 340 470 C364 508 392 530 420 540 V0Z" fill="#262629" />
        <Star x={330} y={250} size={0.9} color="#19a2dc" rotate={12} />
        <Star x={372} y={330} size={0.7} color="#ff7f32" rotate={-10} />
        <Sparkle x={395} y={120} r={3} />
        <Sparkle x={250} y={470} r={2} />
        <Sparkle x={40} y={330} r={1.5} />
      </svg>

      <svg viewBox="0 0 900 420" preserveAspectRatio="xMinYMax meet" className="absolute bottom-0 left-0 w-[min(900px,140vw)] h-auto">
        <defs>
          <mask id="moon-cut">
            <rect width="900" height="420" fill="#fff" />
            <circle cx="598" cy="96" r="30" fill="#000" />
          </mask>
        </defs>
        <path d="M0 150 C140 160 230 250 400 280 C560 308 740 300 900 420 H0Z" fill="#232326" />
        <circle cx="615" cy="104" r="34" fill="#ff7f32" mask="url(#moon-cut)" />
        <path d="M540 175 a20 20 0 0 1 30 -16 a26 26 0 0 1 48 -6 a18 18 0 0 1 30 22Z" fill="#3a3a3d" />
        <path d="M60 420 C150 340 240 330 300 280 C350 238 380 205 420 210 C470 216 530 300 600 420Z" fill="#38383b" />
        <path d="M330 262 C350 240 372 216 398 214 C420 240 380 300 360 320 C330 345 300 360 290 330Z" fill="#303033" />
        <path d="M0 420 C40 380 90 360 140 372 C190 384 230 400 270 420Z" fill="#2f2f32" />
        <path d="M500 420 C560 380 640 370 720 420Z" fill="#38383b" />
        <Tree x={180} base={420} h={60} color="#2b2b2e" />
        <Tree x={215} base={420} h={40} color="#2b2b2e" />
        <Tree x={430} base={420} h={52} color="#46464a" />
        <Tree x={640} base={420} h={70} color="#46464a" />
        <Tree x={672} base={420} h={44} color="#2b2b2e" />
        <Star x={40} y={60} size={0.8} color="#00a3e0" rotate={8} />
        <Star x={470} y={110} size={0.75} color="#ff7f32" rotate={-14} />
        <Sparkle x={140} y={90} r={2} />
        <Sparkle x={230} y={200} r={3} />
        <Sparkle x={70} y={250} r={3.5} />
        <Sparkle x={760} y={330} r={3} />
      </svg>
    </div>
  );
}
