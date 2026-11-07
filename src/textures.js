import * as THREE from 'three';

export const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';

function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function fit(g, text, family, weight, maxSize, maxW) {
  let s = maxSize;
  for (;;) {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= maxW || s <= 24) return s;
    s -= 6;
  }
}

function drawCentered(g, text, cx, cy, { fill, stroke, lineWidth = 0, shadow = null } = {}) {
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const m = g.measureText(text);
  const asc = m.actualBoundingBoxAscent || 0;
  const desc = m.actualBoundingBoxDescent || 0;
  const y = cy + (asc - desc) / 2;
  g.lineJoin = 'round';
  if (shadow) {
    g.save();
    g.fillStyle = shadow;
    if (stroke) {
      g.lineWidth = lineWidth;
      g.strokeStyle = shadow;
      g.strokeText(text, cx, y + lineWidth * 0.45);
    }
    g.fillText(text, cx, y + lineWidth * 0.45);
    g.restore();
  }
  if (stroke) {
    g.lineWidth = lineWidth;
    g.strokeStyle = stroke;
    g.strokeText(text, cx, y);
  }
  g.fillStyle = fill;
  g.fillText(text, cx, y);
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

export function labelTexture(text, { emoji = false, color = '#ffffff', stroke = '#24427a', size = 512, maxFont = 380 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (emoji) {
    fit(g, text, EMOJI_FONT, 400, maxFont * 0.78, size * 0.8);
    drawCentered(g, text, size / 2, size / 2, { fill: '#000' });
  } else {
    const s = fit(g, text, FONT, 800, maxFont, size * 0.84);
    drawCentered(g, text, size / 2, size / 2, {
      fill: color,
      stroke,
      lineWidth: s * 0.16,
      shadow: 'rgba(10,30,70,0.25)',
    });
  }
  return toTexture(c);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function cardTexture({ emoji, text, accent = '#ff8f3f', w = 512, h = 512 }) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const pad = 22;
  g.save();
  g.shadowColor = 'rgba(10,40,90,0.35)';
  g.shadowBlur = 18;
  g.shadowOffsetY = 8;
  roundRect(g, pad, pad, w - pad * 2, h - pad * 2, 70);
  g.fillStyle = '#ffffff';
  g.fill();
  g.restore();
  g.lineWidth = 16;
  g.strokeStyle = accent;
  roundRect(g, pad + 8, pad + 8, w - pad * 2 - 16, h - pad * 2 - 16, 62);
  g.stroke();
  const grad = g.createLinearGradient(0, pad, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, shade(accent, 0.32) + '55');
  roundRect(g, pad + 16, pad + 16, w - pad * 2 - 32, h - pad * 2 - 32, 56);
  g.fillStyle = grad;
  g.fill();

  const ink = shade(accent, -0.28);
  if (emoji && text) {
    fit(g, emoji, EMOJI_FONT, 400, h * 0.42, w * 0.6);
    drawCentered(g, emoji, w / 2, h * 0.38, { fill: '#000' });
    fit(g, text, FONT, 800, h * 0.3, w * 0.78);
    drawCentered(g, text, w / 2, h * 0.76, { fill: ink });
  } else if (emoji) {
    fit(g, emoji, EMOJI_FONT, 400, h * 0.58, w * 0.7);
    drawCentered(g, emoji, w / 2, h / 2, { fill: '#000' });
  } else {
    fit(g, text, FONT, 800, h * 0.62, w * 0.78);
    drawCentered(g, text, w / 2, h / 2, { fill: ink });
  }
  return toTexture(c);
}

export function slotTexture(n, filled, color = '#ffb347') {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
  if (filled) {
    const grad = g.createRadialGradient(s * 0.38, s * 0.32, 4, s / 2, s / 2, s * 0.45);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, shade(color, 0.15));
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 14;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.font = `800 ${s * 0.52}px ${FONT}`;
    drawCentered(g, String(n), s / 2, s / 2, { fill: '#fff', stroke: shade(color, -0.3), lineWidth: 16 });
  } else {
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fill();
    g.setLineDash([22, 16]);
    g.lineWidth = 12;
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.stroke();
  }
  return toTexture(c);
}

export function glowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return toTexture(c);
}

export function gradientBackground() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#9be9f5');
  grad.addColorStop(0.35, '#4fb8e6');
  grad.addColorStop(0.75, '#2a86cf');
  grad.addColorStop(1, '#1f6bb5');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  return toTexture(c);
}

export function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,255,255,0.9)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return toTexture(c);
}
