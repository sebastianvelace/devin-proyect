// Agujero negro cinemático — WebGL2 + GLSL (lente gravitacional procedural)

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uPull;
uniform float uGrow;
uniform vec2 uCenter;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

vec3 starLayer(vec2 uv, float scale, float density) {
  vec2 gv = uv * scale;
  vec2 id = floor(gv);
  vec2 f = fract(gv);
  vec3 col = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cell = id + o;
      float h = hash21(cell);
      if (h > density) continue;
      vec2 starPos = o + vec2(hash21(cell + 1.3), hash21(cell + 7.1)) - f;
      float d = length(starPos);
      float bright = smoothstep(0.08, 0.0, d) * (0.4 + h * 0.9);
      float tw = 0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 6.28);
      vec3 tint = mix(vec3(1.0), vec3(0.85, 0.92, 1.0), step(0.7, h));
      col += tint * bright * tw;
    }
  }
  return col;
}

vec2 lensUv(vec2 uv) {
  vec2 p = uv - uCenter;
  p.x *= uRes.x / uRes.y;
  float r = length(p);
  float rs = 0.055 + uGrow * 0.12;
  float lens = uPull * rs * rs / (r * r + rs * rs * 0.25);
  vec2 dir = r > 0.0001 ? p / r : vec2(0.0, 1.0);
  vec2 warped = p + dir * lens * (1.8 + uGrow * 2.5);
  warped.x /= uRes.x / uRes.y;
  return warped + uCenter;
}

vec3 accretionDisk(vec2 uv) {
  vec2 p = uv - uCenter;
  p.x *= uRes.x / uRes.y;
  float r = length(p);
  float rs = 0.055 + uGrow * 0.12;
  float inner = rs * 2.2;
  float outer = rs * (3.5 + uGrow * 5.0);
  if (r < inner || r > outer) return vec3(0.0);

  float ang = atan(p.y, p.x);
  float spin = uTime * (2.5 + uGrow * 4.0);
  float turbulence = sin(ang * 8.0 + spin * 1.3) * 0.5 + 0.5;
  turbulence *= sin(ang * 3.0 - spin * 0.7 + r * 12.0) * 0.5 + 0.5;

  float doppler = 0.45 + 0.55 * max(0.0, cos(ang + spin * 0.15));
  float band = smoothstep(inner, inner + rs * 0.4, r);
  band *= 1.0 - smoothstep(outer - rs * 0.6, outer, r);
  band *= turbulence * doppler * uGrow;

  vec3 hot = vec3(1.0, 0.75, 0.35);
  vec3 cool = vec3(0.9, 0.25, 0.08);
  vec3 disk = mix(cool, hot, smoothstep(inner, outer * 0.7, r));
  return disk * band * (1.2 + uPull * 0.8);
}

vec3 photonRing(vec2 uv) {
  vec2 p = uv - uCenter;
  p.x *= uRes.x / uRes.y;
  float r = length(p);
  float rs = 0.055 + uGrow * 0.12;
  float ringR = rs * 1.55;
  float ring = exp(-pow((r - ringR) / (rs * 0.12), 2.0)) * uGrow;
  float ang = atan(p.y, p.x);
  float arc = 0.55 + 0.45 * sin(ang * 2.0 + uTime * 0.5);
  vec3 warm = vec3(1.0, 0.85, 0.6);
  vec3 cool = vec3(0.6, 0.75, 1.0);
  return mix(cool, warm, arc) * ring * 1.4;
}

void main() {
  vec2 uv = vUv;
  vec2 lensed = lensUv(uv);

  vec3 col = vec3(0.008, 0.012, 0.028);
  col += starLayer(lensed, 180.0, 0.92) * 0.55;
  col += starLayer(lensed + vec2(0.013, 0.007), 320.0, 0.95) * 0.35;
  col += starLayer(lensed * 1.1, 90.0, 0.88) * 0.25;

  vec3 nebula = vec3(0.12, 0.04, 0.18) * 0.04 * uGrow;
  nebula += vec3(0.25, 0.08, 0.02) * 0.03 * uGrow * (0.5 + 0.5 * sin(uTime * 0.2));
  float nd = length((uv - uCenter) * vec2(uRes.x / uRes.y, 1.0));
  col += nebula * exp(-nd * 2.5);

  col += accretionDisk(uv);
  col += photonRing(uv);

  vec2 p = uv - uCenter;
  p.x *= uRes.x / uRes.y;
  float r = length(p);
  float rs = 0.055 + uGrow * 0.12;
  float shadow = smoothstep(rs * 0.95, rs * 0.7, r);
  col *= shadow;

  float vignette = smoothstep(1.3, 0.35, length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0));
  col *= mix(0.35, 1.0, vignette);

  col = col / (col + vec3(1.0));
  outColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("No se pudo crear shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "unknown";
    gl.deleteShader(sh);
    throw new Error(`Shader compile: ${log}`);
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("No se pudo crear programa");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? "unknown";
    throw new Error(`Program link: ${log}`);
  }
  return prog;
}

/** Renderizador offscreen WebGL2 para la cinemática del agujero negro. */
export class BlackHoleWebGL {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uRes: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uPull: WebGLUniformLocation;
  private uGrow: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) throw new Error("WebGL2 no disponible");
    this.gl = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    this.prog = linkProgram(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.uRes = gl.getUniformLocation(this.prog, "uRes")!;
    this.uTime = gl.getUniformLocation(this.prog, "uTime")!;
    this.uPull = gl.getUniformLocation(this.prog, "uPull")!;
    this.uGrow = gl.getUniformLocation(this.prog, "uGrow")!;
    this.uCenter = gl.getUniformLocation(this.prog, "uCenter")!;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("No se pudo crear VAO");
    this.vao = vao;
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resize(w: number, h: number, dpr: number): void {
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
  }

  draw(
    time: number,
    pull: number,
    grow: number,
    logicalH: number,
    centerY: number,
  ): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uTime, time);
    gl.uniform1f(this.uPull, pull);
    gl.uniform1f(this.uGrow, grow);
    gl.uniform2f(this.uCenter, 0.5, centerY / logicalH);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.prog);
    gl.deleteVertexArray(this.vao);
  }
}
