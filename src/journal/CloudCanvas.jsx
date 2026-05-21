import { useEffect, useRef } from 'react'

/**
 * CloudCanvas — a volumetric raymarched cloud veil, rendered as a DOM overlay.
 *
 * Technique after Maxime Heckel's "Real-time cloudscapes with volumetric
 * raymarching": constant-step raymarch through a 3D-noise FBM density field,
 * directional-derivative lighting. Warm-toned for the mystical-tome aesthetic.
 *
 * Coverage is driven each frame from `veilRef.current.opacity` (0..1) — the
 * `uCover` uniform. At 0 the screen is clear; at 1 the cloud fully covers it,
 * masking a scene swap underneath. Rendered at half resolution (clouds are
 * soft — cheap, and the softness helps).
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCover;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  vec3 q = p + uTime * 0.2 * vec3(1.0, -0.3, -0.6);
  float f = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++) {
    f += a * noise(q);
    q *= 2.03;
    a *= 0.5;
  }
  return f;
}
// cloud density — uCover lifts the floor so the volume fills in, but the
// floor never drops far enough to lose cloud form; the last solid coverage
// comes from the alpha force near uCover = 1.
float density(vec3 p) {
  float base = fbm(p * 1.2);
  float floorv = mix(0.92, 0.38, min(uCover / 0.85, 1.0));
  float d = base - floorv;
  return clamp(d * 3.9, 0.0, 1.0);
}

#define STEPS 40
#define MARCH 0.13

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p2 = uv * 2.0 - 1.0;
  p2.x *= uRes.x / uRes.y;

  vec3 ro = vec3(0.0, 0.0, 4.2);
  vec3 rd = normalize(vec3(p2, -1.35));
  vec3 sun = normalize(vec3(0.55, 0.45, -0.5));

  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float depth = MARCH * dither;

  vec4 res = vec4(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 pos = ro + rd * depth;
    float den = density(pos);
    // confine the cloud to a depth slab so rays don't all saturate to flat
    den *= smoothstep(1.4, 2.2, depth) * (1.0 - smoothstep(4.0, 4.9, depth));
    if (den > 0.01) {
      // directional-derivative diffuse — cheap cloud lighting
      float diff = clamp((den - density(pos + 0.32 * sun)) / 0.32, 0.0, 1.0);
      vec3 dark = vec3(0.24, 0.16, 0.095);
      vec3 lit = vec3(1.08, 0.86, 0.57);
      vec3 col = mix(dark, lit, diff);
      col += vec3(0.32, 0.18, 0.08) * 0.5; // warm inner glow
      vec4 c = vec4(col, den);
      c.rgb *= c.a;
      res += c * (1.0 - res.a);
    }
    depth += MARCH;
    if (res.a > 0.99) break;
  }

  float a = res.a * smoothstep(0.0, 0.12, uCover);
  a = mix(a, 1.0, smoothstep(0.88, 1.0, uCover)); // full cover only at the peak
  vec3 fill = vec3(0.13, 0.085, 0.05); // warm-dark for gaps at full cover
  vec3 rgb = res.a > 0.001 ? res.rgb * (a / res.a) : fill * a;
  gl_FragColor = vec4(rgb, a); // premultiplied
}
`

export default function CloudCanvas({ veilRef }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) return

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[CloudCanvas] shader error:', gl.getShaderInfoLog(s))
      }
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[CloudCanvas] link error:', gl.getProgramInfoLog(prog))
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uCover = gl.getUniformLocation(prog, 'uCover')

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    let raf
    const t0 = performance.now()
    const render = () => {
      const cover = veilRef.current?.opacity ?? 0
      // half resolution — clouds are soft, this is cheap and looks fine
      const scale = 0.5
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale))
      const h = Math.max(1, Math.floor(canvas.clientHeight * scale))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      if (cover > 0.001) {
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform1f(uTime, (performance.now() - t0) / 1000)
        gl.uniform1f(uCover, cover)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      raf = requestAnimationFrame(render)
    }
    render()
    return () => cancelAnimationFrame(raf)
  }, [veilRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
