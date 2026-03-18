import { motion } from 'framer-motion';

function RadarChart({ userAVD, collectiveAVD }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

  // Three axes at 120° apart
  const axes = [
    { label: 'A', angle: -90 },
    { label: 'V', angle: 30 },
    { label: 'D', angle: 150 },
  ];

  const getPoint = (value, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + value * r * Math.cos(rad),
      y: cy + value * r * Math.sin(rad),
    };
  };

  const userPoints = [
    getPoint(userAVD.arousal, axes[0].angle),
    getPoint(userAVD.valence, axes[1].angle),
    getPoint(userAVD.depth, axes[2].angle),
  ];

  const collectivePoints = [
    getPoint(collectiveAVD.arousal, axes[0].angle),
    getPoint(collectiveAVD.valence, axes[1].angle),
    getPoint(collectiveAVD.depth, axes[2].angle),
  ];

  const toPath = (points) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Axis lines */}
      {axes.map((axis) => {
        const end = getPoint(1, axis.angle);
        const labelPos = getPoint(1.15, axis.angle);
        return (
          <g key={axis.label}>
            <line
              x1={cx} y1={cy} x2={end.x} y2={end.y}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1"
            />
            <text
              x={labelPos.x} y={labelPos.y}
              fill="rgba(255,255,255,0.3)"
              fontSize="10"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      {/* Collective polygon */}
      <path
        d={toPath(collectivePoints)}
        fill="rgba(255,255,255,0.05)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />

      {/* User polygon */}
      <path
        d={toPath(userPoints)}
        fill="rgba(176,150,90,0.1)"
        stroke="var(--accent)"
        strokeWidth="1.5"
      />

      {/* User dots */}
      {userPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)" />
      ))}
    </svg>
  );
}

export default function ExitScreen({ userAVD, collectiveAVD, onRestart }) {
  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center px-8 select-none"
      style={{ background: 'var(--bg)', touchAction: 'manipulation' }}
    >
      <motion.p
        className="font-serif text-center mb-10"
        style={{ fontSize: '20px', color: 'var(--text)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      >
        You were always part of this.
      </motion.p>

      <motion.div
        className="mb-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1.5 }}
      >
        <RadarChart userAVD={userAVD} collectiveAVD={collectiveAVD} />
      </motion.div>

      <motion.div
        className="font-mono space-y-2 text-center mb-12"
        style={{ fontSize: '12px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
      >
        <p style={{ color: 'var(--accent)' }}>
          You: A={userAVD.arousal.toFixed(2)} V={userAVD.valence.toFixed(2)} D={userAVD.depth.toFixed(2)}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>
          Everyone: A={collectiveAVD.arousal.toFixed(2)} V={collectiveAVD.valence.toFixed(2)} D={collectiveAVD.depth.toFixed(2)}
        </p>
      </motion.div>

      <motion.button
        className="font-serif"
        style={{
          fontSize: '16px',
          color: 'var(--accent)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '12px 24px',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.5, duration: 0.8 }}
        onClick={onRestart}
      >
        Again
      </motion.button>
    </div>
  );
}
