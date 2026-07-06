import { FONTS, NOCTURNE } from '../score/tokens.js'

// The one-screen thesis-to-artifact STATEMENT page (portfolio §6a) — the thing a
// reviewer reads in 60 seconds. A still PAPER surface: ink on warm paper, serif
// with italic accents, one narrow centered column, quiet. Per the Nocturne canon,
// paper is the material of the record and does not animate beyond a single settle
// on arrival. Light-only by design; no framer-motion (plain CSS settle so the file
// adds no tolerated-lint noise). Route: /statement (see src/main.jsx).

const CSS = `
  html, body { margin: 0; background: ${NOCTURNE.paper}; }

  .stmt-root {
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(56px, 10vh, 112px) clamp(24px, 6vw, 56px);
    color: ${NOCTURNE.paperInk};
    background:
      radial-gradient(128% 92% at 50% 26%, #F8F2E2 0%, ${NOCTURNE.paper} 54%, #EDE4CD 100%);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    font-synthesis: none;
  }

  .stmt-col {
    width: 100%;
    max-width: 640px;
    text-align: center;
    animation: stmt-settle 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes stmt-settle {
    from { opacity: 0; transform: translateY(7px); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .stmt-col { animation: none; }
  }

  .stmt-kicker {
    margin: 0;
    font-family: ${FONTS.mono};
    text-transform: uppercase;
    letter-spacing: 0.44em;
    font-size: 12px;
    opacity: 0.5;
  }

  .stmt-subtitle {
    margin: 18px 0 0;
    font-family: ${FONTS.serif};
    font-style: italic;
    font-weight: 400;
    font-size: clamp(29px, 6vw, 43px);
    line-height: 1.12;
    letter-spacing: 0.005em;
  }

  .stmt-rule {
    border: none;
    width: 38px;
    height: 1px;
    margin: 34px auto;
    background: ${NOCTURNE.paperInk};
    opacity: 0.22;
  }

  .stmt-body {
    font-family: ${FONTS.serif};
    font-size: clamp(16px, 2.35vw, 18px);
    line-height: 1.72;
    text-align: left;
    color: ${NOCTURNE.paperInk};
  }
  .stmt-body p { margin: 0 0 1.15em; }
  .stmt-body p:last-child { margin-bottom: 0; }
  .stmt-body em { font-style: italic; }

  .stmt-figure { margin: 44px 0 6px; }
  .stmt-figure svg {
    display: block;
    width: 100%;
    height: auto;
    max-width: 560px;
    margin: 0 auto;
  }
  .stmt-node-label {
    font-family: ${FONTS.serif};
    font-style: italic;
    fill: ${NOCTURNE.paperInk};
  }
  .stmt-node-sub {
    font-family: ${FONTS.serif};
    font-style: italic;
    fill: ${NOCTURNE.paperInk};
    opacity: 0.72;
  }
  .stmt-caption {
    font-family: ${FONTS.serif};
    font-style: italic;
    fill: ${NOCTURNE.paperInk};
    opacity: 0.62;
  }

  .stmt-footer {
    margin-top: 46px;
    font-family: ${FONTS.mono};
    font-size: 11px;
    line-height: 1.65;
    letter-spacing: 0.015em;
    opacity: 0.48;
    text-align: center;
  }
  .stmt-footer p { margin: 0 0 5px; }
  .stmt-footer p:last-child { margin-bottom: 0; }
`

// The hand-authored-layer diagram: response → meaning → coordinate, the single
// mapping a human wrote by hand. Ink strokes on paper, no library.
function AuthoredLayerDiagram() {
  const ink = NOCTURNE.paperInk
  const paper = NOCTURNE.paper
  return (
    <svg
      viewBox="0 0 640 150"
      role="img"
      aria-label="A human-authored mapping: your response, to its meaning, to a coordinate in arousal, valence, and depth space."
    >
      <title>The one hand-authored layer</title>

      {/* connectors */}
      <g stroke={ink} strokeWidth="1" strokeOpacity="0.6" fill="none" strokeLinecap="round">
        <line x1="123" y1="42" x2="306" y2="42" />
        <path d="M306,42 l-7,-3.6 M306,42 l-7,3.6" />
        <line x1="334" y1="42" x2="517" y2="42" />
        <path d="M517,42 l-7,-3.6 M517,42 l-7,3.6" />
      </g>

      {/* nodes */}
      <g>
        <circle cx="108" cy="42" r="6" fill={paper} stroke={ink} strokeWidth="1.4" />
        <circle cx="108" cy="42" r="1.8" fill={ink} />
        <circle cx="320" cy="42" r="6" fill={paper} stroke={ink} strokeWidth="1.4" />
        <circle cx="320" cy="42" r="1.8" fill={ink} />
        <circle cx="532" cy="42" r="6" fill={paper} stroke={ink} strokeWidth="1.4" />
        <circle cx="532" cy="42" r="1.8" fill={ink} />
      </g>

      {/* labels */}
      <text className="stmt-node-label" x="108" y="70" textAnchor="middle" fontSize="15">
        your response
      </text>
      <text className="stmt-node-label" x="320" y="70" textAnchor="middle" fontSize="15">
        its meaning
      </text>
      <text className="stmt-node-label" x="532" y="70" textAnchor="middle" fontSize="15">
        a coordinate
      </text>
      <text className="stmt-node-sub" x="532" y="89" textAnchor="middle" fontSize="12.5">
        (arousal · valence · depth)
      </text>

      {/* under-brace grouping the whole mapping */}
      <g stroke={ink} strokeWidth="1" strokeOpacity="0.4" fill="none" strokeLinecap="round">
        <path d="M100,104 H540" />
        <path d="M100,104 v-6" />
        <path d="M540,104 v-6" />
        <path d="M320,104 v9" />
      </g>
      <text className="stmt-caption" x="320" y="131" textAnchor="middle" fontSize="12.5">
        the one thing a human authored by hand.
      </text>
    </svg>
  )
}

export default function Statement() {
  return (
    <>
      <style>{CSS}</style>
      <div className="stmt-root">
        <main className="stmt-col">
          <p className="stmt-kicker">PostListener</p>
          <h1 className="stmt-subtitle">an opera for one listener</h1>

          <hr className="stmt-rule" />

          <div className="stmt-body">
            <p>
              PostListener is a hyperinstrument for listening — a chamber opera for an
              audience of one. The listener is the performer: their natural gestures —
              lean, tilt, swell, strike, turn — are read as musical expression. First to{' '}
              <em>write</em> a coordinate of their taste; then to <em>conduct</em> the music
              that coordinate summons.
            </p>
            <p>
              The machine generates every sound. One thing is authored by hand, and only by
              hand: the mapping from a person's response, to its meaning, to a coordinate in
              a space of arousal, valence, and depth. If a machine authored that mapping, the
              maker dissolves. It is the instrument's soul — and the thesis's hinge: taste is{' '}
              <em>the living residue of craft</em>. When the executing hands fall silent,
              craft does not die; it migrates — from making to choosing, from execution to
              curation.
            </p>
            <p>
              It does not claim to measure you. It offers <em>the experience of being seen</em> —
              recognition from a witness, not a measurement — and it refuses to name what it
              saw. Practised ten minutes at a time, the work is not any single session but the
              accumulating record of a taste changing over months and years — <em>an opera
              whose season is a life</em>.
            </p>
          </div>

          <figure className="stmt-figure">
            <AuthoredLayerDiagram />
          </figure>

          <footer className="stmt-footer">
            <p>The collective dimension is presently mocked, and labelled as such wherever it appears.</p>
            <p>a practice-based NID master's thesis artefact, re-formed for the Opera of the Future.</p>
          </footer>
        </main>
      </div>
    </>
  )
}
