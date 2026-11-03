// ═══════════════════════════════════════════════════════════
//  박스 면에 번호를 쓰는 규칙 — 기본 3D · Three.js · 예전 3D 가 모두 같은 규칙을 씀
//  · 박스의 6면(앞·뒤·왼·오른·위·아래) 모두, 면의 한가운데에 번호를 씀
//  · 글자 방향: 옆면은 위쪽이 위, 윗면은 평면도와 같은 방향(오른쪽=+x, 위쪽=평면도의 위쪽), 밑면은 그 반대. 어느 면에서도 거울처럼 뒤집히지 않음
//  · 월드 좌표는 평면도와 같음 (x 오른쪽, y 아래쪽, z 위쪽)
//  · 모양: 보통 굵기, 면 높이의 약 38%, 부드러운 짙은 청회색 글자 (박스에 인쇄된 것처럼 튀지 않게). 구역 색이 연한 12가지로 정해져 있어서 테두리 없이도 읽힘
// ═══════════════════════════════════════════════════════════
export const TXT = {
  CW: 80, CH: 128,          // 글자 하나의 그림 칸 (폭 × 높이, 픽셀)
  COLS: 16, MAX: 256,       // 글자판 한 줄에 놓는 칸 수 / 글자판에 담을 수 있는 글자 종류
  CHARS: 8,                 // 박스 하나의 면에 쓰는 최대 글자 수 (더 길면 앞 8글자)
  CA: 0.46,                 // 글자 간격 (글자 칸 높이 대비) — 숫자 사이가 벌어져 보이지 않게 좁게
  SQ: 0.46 * 128 / 80,      // 글자 칸의 가운데 몇 %만 쓰는지 (= CA × CH ÷ CW: 가로·세로 비율이 그대로 유지되도록)
  FILL_H: 0.8, FILL_W: 0.92, // 글자 칸이 면의 높이/폭에서 차지하는 최대 비율 (숫자 모양은 칸 높이의 약 절반이라 면 높이의 약 38%)
  BASE: 0.74, CAP: 0.475,   // 글씨 바닥선 위치(칸 높이 비율) / 숫자 높이(칸 높이 비율) — 숫자가 칸의 정확히 가운데에 오게
  WEIGHT: 500,              // 글자 굵기 (보통)
  INK: [51, 65, 85], INK_A: 0.92,        // 글자색(부드러운 짙은 청회색) / 진하기
  HALO: [255, 255, 255], HALO_A: 0, HALO_W: 0.05,     // 테두리: 지금은 쓰지 않음(진하기 0). 어두운 색 위에서 읽기 어려우면 HALO_A 를 0.5 쯤으로
}
export const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
export const GLYPH_FONT = 'system-ui, -apple-system, "Segoe UI", "Noto Sans KR", "Malgun Gothic", sans-serif'

/** 면(바깥쪽 방향 n)에서 글자의 오른쪽(tx) · 위쪽(ty) 방향 */
export function faceBasis(n) {
  if (n[2] > 0.5) return { tx: [1, 0, 0], ty: [0, -1, 0] }
  if (n[2] < -0.5) return { tx: [1, 0, 0], ty: [0, 1, 0] }
  return { tx: [n[1], -n[0], 0], ty: [0, 0, 1] }
}
/** 글자 하나가 글자 칸 안에서 가질 수 있는 최대 폭(픽셀) — 이보다 넓은 글자(W, M, 한글)는 가로로 줄임 */
export const glyphMaxW = () => TXT.CW * TXT.SQ - (TXT.HALO_A > 0 ? 2 * TXT.HALO_W * TXT.CH : 4)
export const labelChars = num => [...String(num ?? '')].slice(0, TXT.CHARS)

/** 박스(m: cx cy cz sx sy sz)의 한 면 n 에 글자 cnt 개를 쓸 때의 배치
 *  center=면의 한가운데, hx/hy=면의 가로/세로 절반(글자 방향 기준), th=글자 높이, adv=글자 간격 */
export function faceLayout(m, n, cnt) {
  const { tx, ty } = faceBasis(n), half = [m.sx / 2, m.sy / 2, m.sz / 2]
  const proj = v => Math.abs(v[0]) * half[0] + Math.abs(v[1]) * half[1] + Math.abs(v[2]) * half[2]
  const hx = proj(tx), hy = proj(ty), hn = proj(n)
  const th = Math.min(hy * 2 * TXT.FILL_H, (hx * 2 * TXT.FILL_W) / (Math.max(1, cnt) * TXT.CA))
  return { tx, ty, n, center: [m.cx + n[0] * hn, m.cy + n[1] * hn, m.cz + n[2] * hn], hx, hy, hn, th, adv: th * TXT.CA }
}

/** 글자판(마스크) 만들기 — 브라우저 전용. 칸마다 R=글자 모양, G=흰 테두리(글자를 포함한 더 굵은 모양). 칸 순서는 chars 순서 */
export function buildGlyphMasks(chars) {
  const { CW, CH, COLS } = TXT, rows = Math.max(1, Math.ceil(chars.length / COLS)), W = COLS * CW, H = rows * CH
  const mk = () => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const c = cv.getContext('2d', { willReadFrequently: true }); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.miterLimit = 2
    c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.font = `${TXT.WEIGHT} ${Math.round(CH * 0.66)}px ${GLYPH_FONT}`; return c
  }
  const ink = mk(), halo = mk()
  chars.forEach((ch, i) => {
    const x = (i % COLS) * CW + CW / 2, y = Math.floor(i / COLS) * CH + CH * TXT.BASE, w = ink.measureText(ch).width, lim = glyphMaxW(), sx = w > lim ? lim / w : 1
    for (const { c, lw } of [{ c: ink, lw: 0 }, { c: halo, lw: CH * TXT.HALO_W }]) { c.save(); c.translate(x, y); c.scale(sx, 1); if (lw > 0) { c.lineWidth = lw; c.strokeText(ch, 0, 0) } c.fillText(ch, 0, 0); c.restore() }
  })
  const a = ink.getImageData(0, 0, W, H).data, b = halo.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H * 4)
  for (let p = 0; p < W * H; p++) { const i = a[p * 4 + 3]; out[p * 4] = i; out[p * 4 + 1] = Math.max(b[p * 4 + 3], i); out[p * 4 + 3] = 255 }
  return { data: out, w: W, h: H, rows, chars }
}

/** 글자판에서 글자 하나를 꺼내 RGBA 그림으로 (Three.js 용): 글자색 위에 흰 테두리, 투명한 곳도 테두리색으로 채워 가장자리가 어두워지지 않게.
 *  위아래를 뒤집어 담음 (텍스처의 첫 줄이 아래쪽이라서) */
export function glyphRGBA(atlas, i) {
  const { CW, CH, COLS } = TXT, { data, w } = atlas, gx = (i % COLS) * CW, gy = Math.floor(i / COLS) * CH, out = new Uint8Array(CW * CH * 4), K = TXT.INK, Wc = TXT.HALO
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const s = ((gy + y) * w + gx + x) * 4, ia = (data[s] / 255) * TXT.INK_A, ha = (data[s + 1] / 255) * TXT.HALO_A, a = ia + ha * (1 - ia), o = ((CH - 1 - y) * CW + x) * 4     // 글자(위) + 테두리(아래)를 겹친 결과
    if (a < 1e-4) { out[o] = Wc[0]; out[o + 1] = Wc[1]; out[o + 2] = Wc[2]; out[o + 3] = 0; continue }
    for (let k = 0; k < 3; k++) out[o + k] = Math.round((K[k] * ia + Wc[k] * ha * (1 - ia)) / a)
    out[o + 3] = Math.round(a * 255)
  }
  return out
}
