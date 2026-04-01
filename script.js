// ═══════════════════════════════════════
// ELEMENTS
// ═══════════════════════════════════════
const DC  = document.getElementById('draw-canvas');
const dctx = DC.getContext('2d');
const BGC = document.getElementById('bg-canvas');
const bgctx = BGC.getContext('2d');
const TC  = document.getElementById('template-canvas');
const tctx = TC.getContext('2d');
const LC  = document.getElementById('limb-canvas');
const lctx = LC.getContext('2d');
const AC  = document.getElementById('anim-canvas');
const actx = AC.getContext('2d');
const brushCursor = document.getElementById('brush-cursor');

let color = '#ff8fab', isDrawing = false, isErasing = false;
let penType = 'pen', bgType = 'sky';
let lastPt = null, strokePts = [];
let sprayTimer = null, sprayPt = null;
let animRAF = null, mode = 'walk', t = 0, lastTime = 0;
let charX = 0, charVx = 1.4;
let intensity = 0.7;
let spriteBounds = null, spriteCache = null, hasDrawn = false;
let wasInAir = false, lastStepT = 0;

// ═══════════════════════════════════════
// CHARACTER PARTS (디자이너 PNG 교체 가능)
// ═══════════════════════════════════════
let currentChar = 'cat';
let bodyMaskPath = null;
let limbAngles = {};
let draggingLimb = null;
let blinkTimer = 0, blinkState = 'open';

const CHARACTER_PARTS = {
  cat: {
    body: {
      draw(ctx, cx, cy) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.ellipse(cx, cy, 38, 46, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5; ctx.stroke();
      },
      mask(cx, cy) { const p = new Path2D(); p.ellipse(cx, cy, 38, 46, 0, 0, Math.PI*2); return p; }
    },
    eyes: {
      open(ctx, cx, cy) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(cx-13, cy-10, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+13, cy-10, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(cx-10, cy-13, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+16, cy-13, 2, 0, Math.PI*2); ctx.fill();
      },
      closed(ctx, cx, cy) {
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx-13, cy-10, 4, 0.3, Math.PI-0.3); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+13, cy-10, 4, 0.3, Math.PI-0.3); ctx.stroke();
      }
    },
    decorations: {
      draw(ctx, cx, cy) {
        // 입
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy+4, 13, 0.2, Math.PI-0.2); ctx.stroke();
        // 볼터치
        ctx.fillStyle = 'rgba(255,182,193,0.55)';
        ctx.beginPath(); ctx.ellipse(cx-24, cy+6, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+24, cy+6, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        // 귀
        ctx.fillStyle = '#fde68a'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx-36, cy-26, 9, 13, -0.4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx+36, cy-26, 9, 13,  0.4, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
    },
    limbs: {
      armL: {
        draw(ctx) { ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(0, 14, 7, 18, -0.2, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-36, y:4}, len: 28, default: -0.4, range: [-2.2, 0.8], zBehind: true
      },
      armR: {
        draw(ctx) { ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(0, 14, 7, 18, 0.2, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:36, y:4}, len: 28, default: 0.4, range: [-0.8, 2.2], zBehind: false
      },
      legL: {
        draw(ctx) { ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(0, 16, 8, 18, -0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-14, y:38}, len: 30, default: -0.15, range: [-1.0, 0.6], zBehind: true
      },
      legR: {
        draw(ctx) { ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.ellipse(0, 16, 8, 18, 0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#f59e0b'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:14, y:38}, len: 30, default: 0.15, range: [-0.6, 1.0], zBehind: false
      }
    }
  },
  boy: {
    body: {
      draw(ctx, cx, cy) {
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.ellipse(cx, cy-8, 40, 30, 0, Math.PI, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fcd5a0';
        ctx.beginPath(); ctx.ellipse(cx, cy+4, 36, 42, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#e8a060'; ctx.lineWidth = 2; ctx.stroke();
      },
      mask(cx, cy) { const p = new Path2D(); p.ellipse(cx, cy+4, 36, 42, 0, 0, Math.PI*2); p.ellipse(cx, cy-8, 40, 30, 0, Math.PI, Math.PI*2); return p; }
    },
    eyes: {
      open(ctx, cx, cy) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(cx-13, cy-4, 6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+13, cy-4, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(cx-10, cy-7, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+16, cy-7, 2.5, 0, Math.PI*2); ctx.fill();
      },
      closed(ctx, cx, cy) {
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx-13, cy-4, 5, 0.3, Math.PI-0.3); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+13, cy-4, 5, 0.3, Math.PI-0.3); ctx.stroke();
      }
    },
    decorations: {
      draw(ctx, cx, cy) {
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy+10, 14, 0.2, Math.PI-0.2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,150,120,0.45)';
        ctx.beginPath(); ctx.ellipse(cx-24, cy+12, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+24, cy+12, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        // 귀
        ctx.fillStyle = '#92400e';
        ctx.beginPath(); ctx.ellipse(cx-34, cy-10, 12, 18, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+34, cy-10, 12, 18,  0.3, 0, Math.PI*2); ctx.fill();
      }
    },
    limbs: {
      armL: {
        draw(ctx) { ctx.fillStyle = '#fcd5a0'; ctx.beginPath(); ctx.ellipse(0, 16, 8, 20, -0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#e8a060'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-34, y:8}, len: 30, default: -0.4, range: [-2.2, 0.8], zBehind: true
      },
      armR: {
        draw(ctx) { ctx.fillStyle = '#fcd5a0'; ctx.beginPath(); ctx.ellipse(0, 16, 8, 20, 0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#e8a060'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:34, y:8}, len: 30, default: 0.4, range: [-0.8, 2.2], zBehind: false
      },
      legL: {
        draw(ctx) { ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.ellipse(0, 18, 9, 20, -0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-14, y:42}, len: 32, default: -0.15, range: [-1.0, 0.6], zBehind: true
      },
      legR: {
        draw(ctx) { ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.ellipse(0, 18, 9, 20, 0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:14, y:42}, len: 32, default: 0.15, range: [-0.6, 1.0], zBehind: false
      }
    }
  },
  girl: {
    body: {
      draw(ctx, cx, cy) {
        ctx.fillStyle = '#b45309';
        ctx.beginPath(); ctx.ellipse(cx, cy-8, 40, 28, 0, Math.PI, Math.PI*2); ctx.fill();
        [[-1],[1]].forEach(([dx]) => {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(cx+dx*30, cy-8, 7, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.stroke();
        });
        ctx.fillStyle = '#fcd5a0';
        ctx.beginPath(); ctx.ellipse(cx, cy+4, 34, 42, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#e8a060'; ctx.lineWidth = 2; ctx.stroke();
      },
      mask(cx, cy) { const p = new Path2D(); p.ellipse(cx, cy+4, 34, 42, 0, 0, Math.PI*2); return p; }
    },
    eyes: {
      open(ctx, cx, cy) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.ellipse(cx-13, cy-4, 7, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+13, cy-4, 7, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#6366f1';
        ctx.beginPath(); ctx.ellipse(cx-13, cy-4, 4, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+13, cy-4, 4, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(cx-10, cy-8, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+16, cy-8, 2.5, 0, Math.PI*2); ctx.fill();
      },
      closed(ctx, cx, cy) {
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx-13, cy-4, 5, 0.3, Math.PI-0.3); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+13, cy-4, 5, 0.3, Math.PI-0.3); ctx.stroke();
      }
    },
    decorations: {
      draw(ctx, cx, cy) {
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy+10, 12, 0.2, Math.PI-0.2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,130,150,0.5)';
        ctx.beginPath(); ctx.ellipse(cx-23, cy+12, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+23, cy+12, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        // 머리카락 옆
        ctx.fillStyle = '#b45309';
        [[-1],[1]].forEach(([dx]) => {
          ctx.beginPath(); ctx.ellipse(cx+dx*38, cy+12, 10, 28, dx*0.2, 0, Math.PI*2); ctx.fill();
        });
      }
    },
    limbs: {
      armL: {
        draw(ctx) { ctx.fillStyle = '#fcd5a0'; ctx.beginPath(); ctx.ellipse(0, 16, 7, 19, -0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#e8a060'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-32, y:8}, len: 28, default: -0.4, range: [-2.2, 0.8], zBehind: true
      },
      armR: {
        draw(ctx) { ctx.fillStyle = '#fcd5a0'; ctx.beginPath(); ctx.ellipse(0, 16, 7, 19, 0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#e8a060'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:32, y:8}, len: 28, default: 0.4, range: [-0.8, 2.2], zBehind: false
      },
      legL: {
        draw(ctx) { ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.ellipse(0, 20, 9, 22, -0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#ec4899'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-14, y:42}, len: 34, default: -0.15, range: [-1.0, 0.6], zBehind: true
      },
      legR: {
        draw(ctx) { ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.ellipse(0, 20, 9, 22, 0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#ec4899'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:14, y:42}, len: 34, default: 0.15, range: [-0.6, 1.0], zBehind: false
      }
    }
  },
  dog: {
    body: {
      draw(ctx, cx, cy) {
        ctx.fillStyle = '#e8a060';
        ctx.beginPath(); ctx.ellipse(cx, cy, 38, 40, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#c8864a'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#f5c98a';
        ctx.beginPath(); ctx.ellipse(cx, cy+12, 20, 16, 0, 0, Math.PI*2); ctx.fill();
      },
      mask(cx, cy) { const p = new Path2D(); p.ellipse(cx, cy, 38, 40, 0, 0, Math.PI*2); return p; }
    },
    eyes: {
      open(ctx, cx, cy) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.ellipse(cx, cy+4, 8, 6, 0, 0, Math.PI*2); ctx.fill(); // nose
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(cx-3, cy+2, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(cx-14, cy-10, 6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+14, cy-10, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(cx-11, cy-13, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+17, cy-13, 2.5, 0, Math.PI*2); ctx.fill();
      },
      closed(ctx, cx, cy) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.ellipse(cx, cy+4, 8, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx-14, cy-10, 5, 0.3, Math.PI-0.3); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+14, cy-10, 5, 0.3, Math.PI-0.3); ctx.stroke();
      }
    },
    decorations: {
      draw(ctx, cx, cy) {
        ctx.fillStyle = '#f87171';
        ctx.beginPath(); ctx.ellipse(cx+6, cy+20, 7, 9, 0.2, 0, Math.PI*2); ctx.fill();
        // 귀
        ctx.fillStyle = '#c8864a';
        ctx.beginPath(); ctx.ellipse(cx-36, cy-10, 13, 22, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+36, cy-10, 13, 22,  0.3, 0, Math.PI*2); ctx.fill();
      }
    },
    limbs: {
      armL: {
        draw(ctx) { ctx.fillStyle = '#c8864a'; ctx.beginPath(); ctx.ellipse(0, 18, 8, 22, -0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#a0693a'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-34, y:6}, len: 32, default: -0.35, range: [-2.2, 0.8], zBehind: true
      },
      armR: {
        draw(ctx) { ctx.fillStyle = '#c8864a'; ctx.beginPath(); ctx.ellipse(0, 18, 8, 22, 0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#a0693a'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:34, y:6}, len: 32, default: 0.35, range: [-0.8, 2.2], zBehind: false
      },
      legL: {
        draw(ctx) { ctx.fillStyle = '#c8864a'; ctx.beginPath(); ctx.ellipse(0, 16, 8, 18, -0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#a0693a'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-14, y:34}, len: 28, default: -0.15, range: [-1.0, 0.6], zBehind: true
      },
      legR: {
        draw(ctx) { ctx.fillStyle = '#c8864a'; ctx.beginPath(); ctx.ellipse(0, 16, 8, 18, 0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#a0693a'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:14, y:34}, len: 28, default: 0.15, range: [-0.6, 1.0], zBehind: false
      }
    }
  },
  rabbit: {
    body: {
      draw(ctx, cx, cy) {
        ctx.fillStyle = '#f5f0ff';
        ctx.beginPath(); ctx.ellipse(cx, cy+4, 38, 42, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#d8b4fe'; ctx.lineWidth = 2; ctx.stroke();
      },
      mask(cx, cy) { const p = new Path2D(); p.ellipse(cx, cy+4, 38, 42, 0, 0, Math.PI*2); return p; }
    },
    eyes: {
      open(ctx, cx, cy) {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(cx-13, cy-6, 6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+13, cy-6, 6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(cx-10, cy-9, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+16, cy-9, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fda4af';
        ctx.beginPath(); ctx.ellipse(cx, cy+8, 5, 4, 0, 0, Math.PI*2); ctx.fill();
      },
      closed(ctx, cx, cy) {
        ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx-13, cy-6, 5, 0.3, Math.PI-0.3); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx+13, cy-6, 5, 0.3, Math.PI-0.3); ctx.stroke();
        ctx.fillStyle = '#fda4af';
        ctx.beginPath(); ctx.ellipse(cx, cy+8, 5, 4, 0, 0, Math.PI*2); ctx.fill();
      }
    },
    decorations: {
      draw(ctx, cx, cy) {
        // 귀
        [[-18, 0.1],[18, -0.1]].forEach(([dx, rot]) => {
          ctx.fillStyle = '#f5f0ff';
          ctx.save(); ctx.translate(cx+dx, cy-30); ctx.rotate(rot);
          ctx.beginPath(); ctx.ellipse(0, 0, 11, 30, 0, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#d8b4fe'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#fda4af';
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 22, 0, 0, Math.PI*2); ctx.fill();
          ctx.restore();
        });
        // 수염
        ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 1;
        [[-1],[1]].forEach(([dx]) => {
          ctx.beginPath(); ctx.moveTo(cx+dx*8, cy+10); ctx.lineTo(cx+dx*28, cy+8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx+dx*8, cy+14); ctx.lineTo(cx+dx*28, cy+14); ctx.stroke();
        });
        // 입
        ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, cy+12); ctx.lineTo(cx, cy+18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy+18); ctx.lineTo(cx-8, cy+24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy+18); ctx.lineTo(cx+8, cy+24); ctx.stroke();
        // 볼터치
        ctx.fillStyle = 'rgba(253,164,175,0.45)';
        ctx.beginPath(); ctx.ellipse(cx-24, cy+10, 9, 6, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+24, cy+10, 9, 6, 0, 0, Math.PI*2); ctx.fill();
      }
    },
    limbs: {
      armL: {
        draw(ctx) { ctx.fillStyle = '#f5f0ff'; ctx.beginPath(); ctx.ellipse(0, 14, 7, 17, -0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#d8b4fe'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:-34, y:8}, len: 26, default: -0.4, range: [-2.2, 0.8], zBehind: true
      },
      armR: {
        draw(ctx) { ctx.fillStyle = '#f5f0ff'; ctx.beginPath(); ctx.ellipse(0, 14, 7, 17, 0.15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#d8b4fe'; ctx.lineWidth=1.5; ctx.stroke(); },
        pivot: {x:34, y:8}, len: 26, default: 0.4, range: [-0.8, 2.2], zBehind: false
      },
      legL: {
        draw(ctx) { ctx.fillStyle = '#f5f0ff'; ctx.beginPath(); ctx.ellipse(0, 16, 9, 18, -0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#d8b4fe'; ctx.lineWidth=1.5; ctx.stroke(); ctx.fillStyle='#fda4af'; ctx.beginPath(); ctx.ellipse(0, 22, 4, 3, 0, 0, Math.PI*2); ctx.fill(); },
        pivot: {x:-16, y:38}, len: 30, default: -0.15, range: [-1.0, 0.6], zBehind: true
      },
      legR: {
        draw(ctx) { ctx.fillStyle = '#f5f0ff'; ctx.beginPath(); ctx.ellipse(0, 16, 9, 18, 0.1, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle='#d8b4fe'; ctx.lineWidth=1.5; ctx.stroke(); ctx.fillStyle='#fda4af'; ctx.beginPath(); ctx.ellipse(0, 22, 4, 3, 0, 0, Math.PI*2); ctx.fill(); },
        pivot: {x:16, y:38}, len: 30, default: 0.15, range: [-0.6, 1.0], zBehind: false
      }
    }
  }
};

function resetLimbAngles() {
  const parts = CHARACTER_PARTS[currentChar];
  limbAngles = {};
  for (const [name, limb] of Object.entries(parts.limbs)) {
    limbAngles[name] = limb.default;
  }
}

function drawLimbs() {
  lctx.clearRect(0, 0, LC.width, LC.height);
  const cx = LC.width / 2, cy = LC.height / 2;
  const parts = CHARACTER_PARTS[currentChar];
  if (!parts) return;
  // 뒤쪽 먼저
  for (const [name, limb] of Object.entries(parts.limbs)) {
    if (limb.zBehind) drawOneLimb(lctx, name, limb, cx, cy);
  }
  // 앞쪽
  for (const [name, limb] of Object.entries(parts.limbs)) {
    if (!limb.zBehind) drawOneLimb(lctx, name, limb, cx, cy);
  }
  // 드래그 중 pivot 하이라이트
  if (draggingLimb) {
    const limb = parts.limbs[draggingLimb];
    lctx.fillStyle = 'rgba(147,51,234,0.4)';
    lctx.beginPath();
    lctx.arc(cx + limb.pivot.x, cy + limb.pivot.y, 6, 0, Math.PI*2);
    lctx.fill();
  }
}

function drawOneLimb(ctx, name, limb, cx, cy) {
  ctx.save();
  ctx.translate(cx + limb.pivot.x, cy + limb.pivot.y);
  ctx.rotate(limbAngles[name] || 0);
  limb.draw(ctx);
  ctx.restore();
}

// ── 팔다리 드래그 ──
function getLimbAtPoint(px, py) {
  const cx = LC.width / 2, cy = LC.height / 2;
  const parts = CHARACTER_PARTS[currentChar];
  let closest = null, closestDist = 18;
  for (const [name, limb] of Object.entries(parts.limbs)) {
    const pivotX = cx + limb.pivot.x;
    const pivotY = cy + limb.pivot.y;
    const angle = limbAngles[name] || 0;
    // 팔다리 끝부분 (tip) 근처만 감지
    const tipX = pivotX + Math.cos(angle) * limb.len * 0.8;
    const tipY = pivotY + Math.sin(angle) * limb.len * 0.8;
    const dist = Math.hypot(px - tipX, py - tipY);
    if (dist < closestDist) { closest = name; closestDist = dist; }
  }
  return closest;
}

function limbPointerDown(e) {
  // 도구 패널 열려있으면 닫기
  const tb = document.getElementById('tool-bar');
  if (tb.classList.contains('open')) { togglePalette(); return; }

  const r = LC.getBoundingClientRect();
  const s = e.touches ? e.touches[0] : e;
  const px = (s.clientX - r.left) * (LC.width / r.width);
  const py = (s.clientY - r.top) * (LC.height / r.height);
  const hit = getLimbAtPoint(px, py);
  if (hit) {
    draggingLimb = hit;
    e.preventDefault();
  } else {
    // 팔다리 아님 → 드로잉 이벤트로 전달
    draggingLimb = null;
    startDrawing(e);
  }
}

function limbPointerMove(e) {
  if (draggingLimb) {
    const r = LC.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    const px = (s.clientX - r.left) * (LC.width / r.width);
    const py = (s.clientY - r.top) * (LC.height / r.height);
    const cx = LC.width / 2, cy = LC.height / 2;
    const parts = CHARACTER_PARTS[currentChar];
    const limb = parts.limbs[draggingLimb];
    const pivotX = cx + limb.pivot.x;
    const pivotY = cy + limb.pivot.y;
    let angle = Math.atan2(py - pivotY, px - pivotX);
    angle = Math.max(limb.range[0], Math.min(limb.range[1], angle));
    limbAngles[draggingLimb] = angle;
    drawLimbs();
    e.preventDefault();
  } else if (isDrawing) {
    doStroke(gp(e));
  }
  updateCursor(e);
}

function limbPointerUp(e) {
  if (draggingLimb) {
    draggingLimb = null;
    drawLimbs();
  } else {
    stopDrawing();
  }
}

LC.addEventListener('mousedown', limbPointerDown);
LC.addEventListener('mousemove', limbPointerMove);
LC.addEventListener('mouseup', limbPointerUp);
LC.addEventListener('mouseleave', () => { if (isDrawing) stopDrawing(); draggingLimb = null; brushCursor.style.display = 'none'; });
LC.addEventListener('touchstart', e => { e.preventDefault(); limbPointerDown(e); }, { passive: false });
LC.addEventListener('touchmove', e => { e.preventDefault(); limbPointerMove(e); }, { passive: false });
LC.addEventListener('touchend', e => { e.preventDefault(); limbPointerUp(e); }, { passive: false });
LC.addEventListener('mouseenter', () => { brushCursor.style.display = 'block'; });

// ═══════════════════════════════════════
// SOUND (Web Audio API)
// ═══════════════════════════════════════
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now); osc.stop(now + 0.06);
        break;
      case 'pop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.13);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.start(now); osc.stop(now + 0.13);
        break;
      case 'whoosh':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now); osc.stop(now + 0.18);
        break;
      case 'boing':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.22);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now); osc.stop(now + 0.22);
        break;
      case 'thud':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now); osc.stop(now + 0.18);
        break;
      case 'step':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280 + Math.random() * 120, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.04);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now); osc.stop(now + 0.04);
        break;
      case 'sparkle': {
        [0, 0.06, 0.12].forEach((d, i) => {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.connect(g2); g2.connect(ctx.destination);
          o2.type = 'sine';
          o2.frequency.setValueAtTime([700, 900, 1150][i], now + d);
          g2.gain.setValueAtTime(0.06, now + d);
          g2.gain.exponentialRampToValueAtTime(0.001, now + d + 0.1);
          o2.start(now + d); o2.stop(now + d + 0.1);
        });
        return;
      }
    }
  } catch (_) { /* audio not available */ }
}

// ═══════════════════════════════════════
// UNDO / REDO
// ═══════════════════════════════════════
const history = [];
let histIdx = -1;
const MAX_HIST = 25;

function saveHistory() {
  if (DC.width === 0) return;
  history.splice(histIdx + 1);
  history.push(DC.toDataURL());
  if (history.length > MAX_HIST) history.shift();
  histIdx = history.length - 1;
}

function undo() {
  if (histIdx <= 0) return;
  histIdx--;
  restoreHistory();
  playSound('whoosh');
}

function redo() {
  if (histIdx >= history.length - 1) return;
  histIdx++;
  restoreHistory();
  playSound('whoosh');
}

function restoreHistory() {
  const img = new Image();
  img.onload = () => {
    dctx.clearRect(0, 0, DC.width, DC.height);
    dctx.drawImage(img, 0, 0);
    spriteBounds = null; spriteCache = null;
  };
  img.src = history[histIdx];
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

// ═══════════════════════════════════════
// RESIZE
// ═══════════════════════════════════════
function resize() {
  const dw = DC.parentElement.clientWidth, dh = DC.parentElement.clientHeight;
  if (dw > 0) {
    const saved = document.createElement('canvas');
    saved.width = DC.width; saved.height = DC.height;
    if (DC.width > 0) saved.getContext('2d').drawImage(DC, 0, 0);
    DC.width = dw; DC.height = dh;
    BGC.width = dw; BGC.height = dh;
    TC.width = dw; TC.height = dh;
    LC.width = dw; LC.height = dh;
    if (saved.width > 0) dctx.drawImage(saved, 0, 0, saved.width, saved.height, 0, 0, dw, dh);
    drawDrawBg();
    // 템플릿 + 마스크 + 팔다리 재생성
    if (currentChar && CHARACTER_PARTS[currentChar]) {
      const cx = dw / 2, cy = dh / 2;
      const parts = CHARACTER_PARTS[currentChar];
      tctx.clearRect(0, 0, dw, dh);
      parts.body.draw(tctx, cx, cy);
      parts.decorations.draw(tctx, cx, cy);
      parts.eyes.open(tctx, cx, cy);
      bodyMaskPath = parts.body.mask(cx, cy);
      drawLimbs();
    }
    spriteBounds = null; spriteCache = null;
  }
  const aw = AC.parentElement.clientWidth, ah = AC.parentElement.clientHeight;
  if (aw > 0) {
    AC.width = aw; AC.height = ah;
    charX = aw / 2;
    spriteBounds = null; spriteCache = null;
  }
}
resize();
window.addEventListener('resize', resize);

// ═══════════════════════════════════════
// BRUSH CURSOR
// ═══════════════════════════════════════
function updateCursor(e) {
  const r = LC.getBoundingClientRect();
  const s = e.touches ? e.touches[0] : e;
  const x = s.clientX - r.left;
  const y = s.clientY - r.top;
  const size = +document.getElementById('bsize').value * (isErasing ? 2.5 : 1);
  const scale = r.width / DC.width;
  const d = size * scale;
  brushCursor.style.left = (x - d / 2) + 'px';
  brushCursor.style.top  = (y - d / 2) + 'px';
  brushCursor.style.width = d + 'px';
  brushCursor.style.height = d + 'px';
  brushCursor.style.display = 'block';
  if (isErasing) {
    brushCursor.style.borderColor = 'rgba(239,68,68,0.5)';
  } else {
    brushCursor.style.borderColor = 'rgba(147,51,234,0.45)';
  }
}

// 커서 이벤트는 limb-canvas에서 처리

// ═══════════════════════════════════════
// DRAWING (Bezier smoothing)
// ═══════════════════════════════════════
function gp(e) {
  const r = LC.getBoundingClientRect();
  const sx = DC.width / r.width, sy = DC.height / r.height;
  const s = e.touches ? e.touches[0] : e;
  return { x: (s.clientX - r.left) * sx, y: (s.clientY - r.top) * sy };
}

function smoothDraw(p) {
  strokePts.push(p);
  if (strokePts.length < 3) {
    dctx.lineTo(p.x, p.y);
    dctx.stroke();
    dctx.beginPath();
    dctx.moveTo(p.x, p.y);
    return;
  }
  const p1 = strokePts[strokePts.length - 2];
  const mid = { x: (p1.x + p.x) / 2, y: (p1.y + p.y) / 2 };
  dctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);
  dctx.stroke();
  dctx.beginPath();
  dctx.moveTo(mid.x, mid.y);
}

function doStroke(p) {
  const size = +document.getElementById('bsize').value;

  // 마스크 적용 (있으면 body 안에서만 그리기)
  if (bodyMaskPath && !isErasing) {
    dctx.save();
    dctx.clip(bodyMaskPath);
  }

  if (isErasing) {
    dctx.globalCompositeOperation = 'destination-out';
    dctx.lineWidth = size * 2.5;
    dctx.strokeStyle = 'rgba(0,0,0,1)';
    dctx.lineCap = 'round'; dctx.lineJoin = 'round';
    smoothDraw(p);
    if (bodyMaskPath && !isErasing) dctx.restore();
    markDrawn(); return;
  }

  dctx.globalCompositeOperation = 'source-over';

  if (penType === 'pen') {
    dctx.globalAlpha = 1;
    dctx.lineWidth = size;
    dctx.strokeStyle = color;
    dctx.lineCap = 'round'; dctx.lineJoin = 'round';
    smoothDraw(p);

  } else if (penType === 'marker') {
    dctx.globalAlpha = 0.38;
    dctx.lineWidth = size * 3;
    dctx.strokeStyle = color;
    dctx.lineCap = 'square'; dctx.lineJoin = 'round';
    smoothDraw(p);
    dctx.globalAlpha = 1;

  } else if (penType === 'brush') {
    let w = size * 1.6;
    if (lastPt) {
      const dx = p.x - lastPt.x, dy = p.y - lastPt.y;
      w = Math.max(1, size * 2.0 - Math.sqrt(dx*dx + dy*dy) * 0.5);
    }
    dctx.globalAlpha = 0.88;
    dctx.lineWidth = w;
    dctx.strokeStyle = color;
    dctx.lineCap = 'round'; dctx.lineJoin = 'round';
    smoothDraw(p);
    dctx.globalAlpha = 1;

  } else if (penType === 'crayon') {
    dctx.globalAlpha = 0.75;
    dctx.lineWidth = size * 1.3;
    dctx.strokeStyle = color;
    dctx.lineCap = 'round'; dctx.lineJoin = 'round';
    dctx.lineTo(p.x, p.y); dctx.stroke();
    dctx.beginPath(); dctx.moveTo(p.x, p.y);
    for (let i = 0; i < 4; i++) {
      const ox = (Math.random() - 0.5) * size * 1.8;
      const oy = (Math.random() - 0.5) * size * 1.8;
      dctx.globalAlpha = Math.random() * 0.35;
      dctx.fillStyle = color;
      dctx.beginPath();
      dctx.arc(p.x + ox, p.y + oy, Math.random() * size * 0.45 + 0.5, 0, Math.PI * 2);
      dctx.fill();
    }
    dctx.globalAlpha = 1;

  } else if (penType === 'spray') {
    sprayPt = p; return;
  }

  lastPt = p;
  if (bodyMaskPath) dctx.restore();
  markDrawn();
}

function doSpray() {
  if (!sprayPt) return;
  const size = +document.getElementById('bsize').value;
  const radius = size * 2.8;
  if (bodyMaskPath) { dctx.save(); dctx.clip(bodyMaskPath); }
  dctx.globalCompositeOperation = 'source-over';
  dctx.fillStyle = color;
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    dctx.globalAlpha = Math.random() * 0.55 + 0.1;
    dctx.beginPath();
    dctx.arc(sprayPt.x + Math.cos(angle)*r, sprayPt.y + Math.sin(angle)*r, 0.9, 0, Math.PI*2);
    dctx.fill();
  }
  dctx.globalAlpha = 1;
  if (bodyMaskPath) dctx.restore();
  markDrawn();
}

function markDrawn() {
  hasDrawn = true;
  document.getElementById('hint').style.display = 'none';
}

function startDrawing(e) {
  isDrawing = true; lastPt = null; strokePts = [];
  const p = gp(e);
  strokePts.push(p);
  dctx.beginPath(); dctx.moveTo(p.x, p.y);
  if (penType === 'spray') { sprayPt = p; sprayTimer = setInterval(doSpray, 30); }
}
function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  dctx.globalCompositeOperation = 'source-over';
  dctx.globalAlpha = 1;
  lastPt = null; strokePts = [];
  if (sprayTimer) { clearInterval(sprayTimer); sprayTimer = null; }
  saveHistory();
}

// 드로잉 이벤트는 limb-canvas에서 라우팅 처리

// ═══════════════════════════════════════
// PALETTE / PEN / BG / COLOR
// ═══════════════════════════════════════
function setPen(type, el) {
  penType = type; isErasing = false;
  document.querySelectorAll('.pbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('eraser-btn').classList.remove('active');
  document.getElementById('pen-name').textContent =
    { pen:'기본 펜', marker:'형광펜', brush:'붓', crayon:'크레용', spray:'스프레이' }[type];
  playSound('click');
}
function setBg(type, el) {
  bgType = type;
  document.querySelectorAll('.bgbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  drawDrawBg();
  showBgPreview(type);
  playSound('pop');
}
function setColor(c, el) {
  color = c; isErasing = false;
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('eraser-btn').classList.remove('active');
  playSound('click');
}
function toggleEraser() {
  isErasing = !isErasing;
  document.getElementById('eraser-btn').classList.toggle('active', isErasing);
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  playSound('click');
}
function clearDraw() {
  dctx.clearRect(0, 0, DC.width, DC.height);
  spriteBounds = null; spriteCache = null; hasDrawn = false;
  document.getElementById('hint').style.display = '';
  // 현재 캐릭터 다시 로드 (템플릿+팔다리 유지)
  if (currentChar && CHARACTER_PARTS[currentChar]) {
    const cx = DC.width / 2, cy = DC.height / 2;
    const parts = CHARACTER_PARTS[currentChar];
    tctx.clearRect(0, 0, TC.width, TC.height);
    parts.body.draw(tctx, cx, cy);
    parts.decorations.draw(tctx, cx, cy);
    parts.eyes.open(tctx, cx, cy);
    bodyMaskPath = parts.body.mask(cx, cy);
    drawLimbs();
  }
  saveHistory();
  playSound('whoosh');
}

function drawDrawBg() {
  const W = BGC.width, H = BGC.height;
  if (!W || !H) return;
  bgctx.clearRect(0, 0, W, H);
  drawBgOn(bgctx, W, H, H * 0.82, 1, W / 2, 0);
}

// ═══════════════════════════════════════
// SAVE / LOAD
// ═══════════════════════════════════════
function saveDraw() {
  const c = document.createElement('canvas');
  c.width = DC.width; c.height = DC.height;
  const cx = c.getContext('2d');
  cx.drawImage(BGC, 0, 0);
  cx.drawImage(DC, 0, 0);
  const a = document.createElement('a');
  a.download = 'my-drawing.png';
  a.href = c.toDataURL();
  a.click();
  playSound('sparkle');
}

function loadDraw(input) {
  const file = input.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    clearDraw();
    dctx.drawImage(img, 0, 0, DC.width, DC.height);
    hasDrawn = true; spriteBounds = null; spriteCache = null;
    document.getElementById('hint').style.display = 'none';
    saveHistory();
    playSound('pop');
  };
  img.src = URL.createObjectURL(file);
  input.value = '';
}

// ═══════════════════════════════════════
// CHARACTER TEMPLATES (파트 시스템)
// ═══════════════════════════════════════
function loadChar(type, el) {
  if (el) {
    document.querySelectorAll('.cbtn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  }
  currentChar = type;
  const parts = CHARACTER_PARTS[type];
  if (!parts) return;

  // 드로잉 캔버스 클리어
  dctx.clearRect(0, 0, DC.width, DC.height);
  spriteBounds = null; spriteCache = null; hasDrawn = false;
  document.getElementById('hint').style.display = 'none';

  const cx = DC.width / 2, cy = DC.height / 2;

  // 1. 템플릿 캔버스에 밑그림 (반투명 가이드)
  tctx.clearRect(0, 0, TC.width, TC.height);
  parts.body.draw(tctx, cx, cy);
  parts.decorations.draw(tctx, cx, cy);
  parts.eyes.open(tctx, cx, cy);

  // 2. 바디 마스크 생성
  bodyMaskPath = parts.body.mask(cx, cy);

  // 3. 팔다리 초기화 + 렌더링
  resetLimbAngles();
  drawLimbs();

  hasDrawn = true;
  saveHistory();
  playSound('pop');
}

// (캐릭터 그리기 함수는 CHARACTER_PARTS로 이동됨)

// ═══════════════════════════════════════
// PALETTE TOGGLE
// ═══════════════════════════════════════
function togglePalette() {
  const tb = document.getElementById('tool-bar');
  const btn = document.getElementById('palette-btn');
  const opening = !tb.classList.contains('open');
  if (typeof gsap !== 'undefined') {
    if (opening) {
      tb.classList.add('open');
      btn.classList.add('open');
      btn.textContent = '✕ 닫기';
      gsap.fromTo(tb, { y: '100%' }, { y: '0%', duration: 0.3, ease: 'back.out(1.3)' });
    } else {
      gsap.to(tb, { y: '100%', duration: 0.2, ease: 'power2.in', onComplete: () => {
        tb.classList.remove('open');
        btn.classList.remove('open');
        btn.textContent = '🎨 도구';
      }});
    }
  } else {
    tb.classList.toggle('open');
    btn.classList.toggle('open', tb.classList.contains('open'));
    btn.textContent = tb.classList.contains('open') ? '✕ 닫기' : '🎨 도구';
  }
  playSound('click');
}

// ═══════════════════════════════════════
// VIEW TRANSITIONS (GSAP)
// ═══════════════════════════════════════
function closePalette() {
  const tb = document.getElementById('tool-bar');
  const btn = document.getElementById('palette-btn');
  tb.classList.remove('open');
  tb.style.transform = '';
  btn.classList.remove('open');
  btn.textContent = '🎨 도구';
}

function showDraw() {
  cancelAnimationFrame(animRAF);
  const dv = document.getElementById('draw-view');
  const av = document.getElementById('anim-view');

  dv.style.display = 'flex';

  if (typeof gsap !== 'undefined') {
    dv.style.zIndex = '1'; av.style.zIndex = '0';
    gsap.fromTo(dv, { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out',
        onComplete: () => {
          av.style.display = 'none';
          dv.style.zIndex = ''; av.style.zIndex = '';
          requestAnimationFrame(resize);
        }});
    gsap.to(av, { opacity: 0, scale: 1.06, duration: 0.3, ease: 'power2.inOut' });
  } else {
    av.style.display = 'none';
    requestAnimationFrame(resize);
  }
  playSound('whoosh');
}

function startAnim() {
  closePalette();
  spriteBounds = null; spriteCache = null;
  cancelAnimationFrame(animRAF);
  t = 0; lastTime = 0; charVx = 1.4;
  wasInAir = false; lastStepT = 0;

  const dv = document.getElementById('draw-view');
  const av = document.getElementById('anim-view');

  av.style.display = 'flex';

  if (typeof gsap !== 'undefined') {
    av.style.zIndex = '1'; dv.style.zIndex = '0';
    gsap.fromTo(av, { opacity: 0, scale: 1.06 },
      { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' });
    gsap.to(dv, { opacity: 0, scale: 0.92, duration: 0.3, ease: 'power2.inOut',
      onComplete: () => {
        dv.style.display = 'none';
        gsap.set(dv, { opacity: 1, scale: 1 });
        dv.style.zIndex = ''; av.style.zIndex = '';
        requestAnimationFrame(() => {
          resize();
          updateSpriteCache();
          animLoop(performance.now());
        });
      }});
  } else {
    dv.style.display = 'none';
    requestAnimationFrame(() => { resize(); updateSpriteCache(); animLoop(performance.now()); });
  }
  playSound('sparkle');
}

// ═══════════════════════════════════════
// SPRITE BOUNDS & CACHE
// ═══════════════════════════════════════
function getBounds() {
  const d = dctx.getImageData(0, 0, DC.width, DC.height).data;
  let x0 = DC.width, x1 = 0, y0 = DC.height, y1 = 0, found = false;
  for (let y = 0; y < DC.height; y++) for (let x = 0; x < DC.width; x++) {
    if (d[(y * DC.width + x) * 4 + 3] > 15) {
      found = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!found) { const cx = DC.width/2, cy = DC.height/2; return { x:cx-40, y:cy-50, w:80, h:100 }; }
  return { x:x0, y:y0, w:x1-x0+1, h:y1-y0+1 };
}

function updateSpriteCache() {
  // 합성 캔버스: body 색칠 + decorations + eyes (팔다리 제외)
  const parts = CHARACTER_PARTS[currentChar];
  const cw = DC.width, ch = DC.height;
  const cx = cw / 2, cy = ch / 2;

  const comp = document.createElement('canvas');
  comp.width = cw; comp.height = ch;
  const cctx = comp.getContext('2d');

  // body 배경 (색칠 뒤에 보이게)
  if (parts) parts.body.draw(cctx, cx, cy);
  // 유저 색칠
  cctx.drawImage(DC, 0, 0);
  // decorations
  if (parts) parts.decorations.draw(cctx, cx, cy);
  // eyes는 blink 때문에 animLoop에서 직접 그림

  // bounds 계산
  const d = cctx.getImageData(0, 0, cw, ch).data;
  let x0 = cw, x1 = 0, y0 = ch, y1 = 0, found = false;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (d[(y * cw + x) * 4 + 3] > 15) {
      found = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!found) { x0 = cx-40; y0 = cy-50; x1 = cx+40; y1 = cy+50; }
  spriteBounds = { x: x0, y: y0, w: x1-x0+1, h: y1-y0+1 };

  const b = spriteBounds;
  spriteCache = document.createElement('canvas');
  spriteCache.width = b.w; spriteCache.height = b.h;
  spriteCache.getContext('2d').drawImage(comp, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
}

// ═══════════════════════════════════════
// BACKGROUNDS
// ═══════════════════════════════════════
function drawBg(charY, scaleX) {
  drawBgOn(actx, AC.width, AC.height, charY, scaleX, charX, t);
}

function drawBgOn(ctx, W, H, charY, scaleX, cx, time) {
  if (bgType === 'sky') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#c7eaff'); g.addColorStop(1, '#e8f8ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    [[W*0.1,H*0.15,40],[W*0.42,H*0.1,55],[W*0.7,H*0.18,44],[W*0.9,H*0.12,35]].forEach(([x,y,r]) => {
      ctx.globalAlpha = 0.75; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, r*0.55, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+r*0.48, y+5, r*0.42, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x-r*0.36, y+8, r*0.36, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    const gY = H * 0.82;
    ctx.fillStyle = '#b5efc4'; ctx.fillRect(0, gY, W, H - gY);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#82d996'; ctx.beginPath(); ctx.arc(i*(W/7)+10, gY+2, 16, 0, Math.PI, true); ctx.fill(); }
    drawShadow(ctx, charY, scaleX, gY, '#6b7280', cx);

  } else if (bgType === 'night') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0a2e'); g.addColorStop(1, '#1e1040');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 55; i++) {
      const sx = (Math.sin(i*137.5)*0.5+0.5)*W, sy = (Math.sin(i*97.3)*0.5+0.5)*H*0.75;
      ctx.globalAlpha = 0.4+Math.sin(time*2+i)*0.3; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, 0.8+(i%3)*0.4, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fef3c7'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(W*0.82, H*0.15, 16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1e1040';
    ctx.beginPath(); ctx.arc(W*0.82+7, H*0.15-4, 13, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    const gY = H*0.82;
    ctx.fillStyle = '#1a0a3e'; ctx.fillRect(0, gY, W, H-gY);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#2d1060'; ctx.beginPath(); ctx.arc(i*(W/7)+10, gY+2, 14, 0, Math.PI, true); ctx.fill(); }
    drawShadow(ctx, charY, scaleX, gY, '#6030a0', cx);

  } else if (bgType === 'ocean') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#87ceeb'); g.addColorStop(0.55, '#4a90d9'); g.addColorStop(1, '#1e5fa8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const gY = H*0.82;
    [['#2e86c1',0],['#1a6fa0',6],['#0d5a8a',12]].forEach(([fc, off]) => {
      ctx.fillStyle = fc; ctx.beginPath(); ctx.moveTo(0, gY+off);
      for (let x = 0; x <= W; x += 4) ctx.lineTo(x, gY+off+Math.sin((x/W)*Math.PI*5+time*2)*5);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    });
    ctx.globalAlpha = 1;
    drawShadow(ctx, charY, scaleX, gY, '#1a5276', cx);

  } else if (bgType === 'space') {
    ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      const sx = (Math.sin(i*137.5)*0.5+0.5)*W, sy = (Math.cos(i*97.3)*0.5+0.5)*H;
      ctx.globalAlpha = 0.3+Math.abs(Math.sin(time*1.5+i*0.7))*0.7;
      ctx.fillStyle = i%5===0?'#ffd700':i%3===0?'#add8e6':'#fff';
      ctx.beginPath(); ctx.arc(sx, sy, 0.7+(i%4)*0.35, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const pg = ctx.createRadialGradient(W*0.15,H*0.2,2,W*0.15,H*0.2,20);
    pg.addColorStop(0,'#ff9966'); pg.addColorStop(1,'#c0392b');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(W*0.15,H*0.2,20,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,180,100,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(W*0.15,H*0.2,32,8,-0.3,0,Math.PI*2); ctx.stroke();
    drawShadow(ctx, charY, scaleX, H*0.85, '#4040a0', cx);

  } else if (bgType === 'classroom') {
    const wg = ctx.createLinearGradient(0,0,0,H);
    wg.addColorStop(0,'#fef9e7'); wg.addColorStop(1,'#fdf3d0');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
    const bx=W*0.14, by=H*0.07, bw=W*0.72, bh=H*0.42;
    ctx.fillStyle = '#2d6a4f'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#8b6040'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#d4edda'; ctx.globalAlpha = 0.9;
    ctx.font = `bold ${Math.round(H*0.09)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('ABC  Hello!', W/2, by+bh*0.5);
    ctx.font = `${Math.round(H*0.045)}px sans-serif`;
    ctx.fillText('Good morning~', W/2, by+bh*0.82);
    ctx.globalAlpha = 1; ctx.textAlign = 'start';
    const gY = H*0.82;
    ctx.fillStyle = '#c8a87a'; ctx.fillRect(0, gY, W, H-gY);
    ctx.strokeStyle = '#b0925c'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += W/7) { ctx.beginPath(); ctx.moveTo(x,gY); ctx.lineTo(x,H); ctx.stroke(); }
    ctx.fillStyle = '#87ceeb'; ctx.fillRect(W*0.02,H*0.12,W*0.09,H*0.32);
    ctx.strokeStyle = '#8b6040'; ctx.lineWidth = 2; ctx.strokeRect(W*0.02,H*0.12,W*0.09,H*0.32);
    ctx.beginPath(); ctx.moveTo(W*0.065,H*0.12); ctx.lineTo(W*0.065,H*0.44); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*0.02,H*0.28); ctx.lineTo(W*0.11,H*0.28); ctx.stroke();
    drawShadow(ctx, charY, scaleX, gY, '#8b6040', cx);

  } else if (bgType === 'park') {
    const pg2 = ctx.createLinearGradient(0,0,0,H);
    pg2.addColorStop(0,'#87ceeb'); pg2.addColorStop(1,'#d4eaff');
    ctx.fillStyle = pg2; ctx.fillRect(0, 0, W, H);
    [[W*0.18,H*0.12,38],[W*0.62,H*0.08,48]].forEach(([x,y,r]) => {
      ctx.globalAlpha = 0.88; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x,y,r*0.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+r*0.45,y+4,r*0.4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x-r*0.35,y+6,r*0.35,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });
    const gY = H*0.82;
    ctx.fillStyle = '#5cb85c'; ctx.fillRect(0, gY, W, H-gY);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(i*(W/8),gY+2,14,0,Math.PI,true); ctx.fill(); }
    ctx.fillStyle = '#d2a679';
    ctx.beginPath(); ctx.moveTo(W*0.38,gY); ctx.lineTo(W*0.62,gY); ctx.lineTo(W*0.75,H); ctx.lineTo(W*0.25,H); ctx.closePath(); ctx.fill();
    [[W*0.07,gY],[W*0.93,gY]].forEach(([tx,ty]) => {
      ctx.fillStyle = '#795548'; ctx.fillRect(tx-5,ty-H*0.18,10,H*0.18);
      ctx.fillStyle = '#388e3c'; ctx.beginPath(); ctx.arc(tx,ty-H*0.22,H*0.14,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(tx,ty-H*0.27,H*0.10,0,Math.PI*2); ctx.fill();
    });
    ['#ff69b4','#ffeb3b','#ff6b6b','#9c27b0','#ff9800'].forEach((fc,i) => {
      const fx = W*0.14+i*W*0.17, fy = gY+9;
      ctx.fillStyle = fc; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(fx,fy,4.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(fx,fy,2,0,Math.PI*2); ctx.fill();
    });
    drawShadow(ctx, charY, scaleX, gY, '#2d7a2d', cx);

  } else if (bgType === 'home') {
    const hg = ctx.createLinearGradient(0,0,0,H);
    hg.addColorStop(0,'#fce4d6'); hg.addColorStop(1,'#fbd5c5');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    const gY = H*0.82;
    ctx.fillStyle = '#c8a87a'; ctx.fillRect(0, gY, W, H-gY);
    ctx.strokeStyle = '#b0925c'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += W/8) { ctx.beginPath(); ctx.moveTo(x,gY); ctx.lineTo(x,H); ctx.stroke(); }
    const wx=W*0.62,wy=H*0.07,ww=W*0.3,wh=H*0.4;
    const skyG = ctx.createLinearGradient(0,0,0,H*0.5);
    skyG.addColorStop(0,'#87ceeb'); skyG.addColorStop(1,'#c7eaff');
    ctx.fillStyle = skyG; ctx.fillRect(wx,wy,ww,wh);
    ctx.fillStyle = '#ffd700'; ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(wx+ww*0.7,wy+wh*0.3,H*0.07,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fca5a5';
    [[wx,1],[wx+ww,-1]].forEach(([sX,dir]) => {
      ctx.beginPath(); ctx.moveTo(sX,wy);
      for (let i = 0; i <= 4; i++) ctx.lineTo(sX+dir*i*ww*0.12, wy+(i%2===0?0:wh*0.38));
      ctx.lineTo(sX+dir*ww*0.48,wy+wh*0.38); ctx.lineTo(sX+dir*ww*0.48,wy); ctx.closePath(); ctx.fill();
    });
    ctx.strokeStyle = '#8b6040'; ctx.lineWidth = 3; ctx.strokeRect(wx,wy,ww,wh);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(wx+ww/2,wy); ctx.lineTo(wx+ww/2,wy+wh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx,wy+wh/2); ctx.lineTo(wx+ww,wy+wh/2); ctx.stroke();
    ctx.fillStyle = '#f5deb3'; ctx.fillRect(W*0.04,H*0.1,W*0.22,H*0.28);
    ctx.strokeStyle = '#8b6040'; ctx.lineWidth = 3; ctx.strokeRect(W*0.04,H*0.1,W*0.22,H*0.28);
    ctx.fillStyle = '#b3d9f5'; ctx.fillRect(W*0.06,H*0.12,W*0.18,H*0.24);
    ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(W*0.1,H*0.18,H*0.05,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#5cb85c'; ctx.fillRect(W*0.06,H*0.28,W*0.18,H*0.08);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(W*0.28,gY-H*0.14,W*0.38,H*0.06);
    ctx.fillRect(W*0.28,gY-H*0.09,W*0.38,H*0.09);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(W*0.25,gY-H*0.17,W*0.06,H*0.17);
    ctx.fillRect(W*0.69,gY-H*0.17,W*0.06,H*0.17);
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath(); ctx.ellipse(W*0.39,gY-H*0.12,W*0.07,H*0.06,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(W*0.56,gY-H*0.12,W*0.07,H*0.06,0,0,Math.PI*2); ctx.fill();
    drawShadow(ctx, charY, scaleX, gY, '#8b6040', cx);
  }
}

function drawShadow(ctx, charY, scaleX, gY, shadowColor, cx) {
  const dist = Math.max(0, gY - charY);
  const sAlpha = Math.max(0.03, 0.18 - dist * 0.0015);
  const sScale = Math.max(0.3, 1 - dist * 0.005);
  ctx.globalAlpha = sAlpha;
  ctx.fillStyle = shadowColor;
  ctx.beginPath();
  ctx.ellipse(cx, gY + 4, 28 * Math.abs(scaleX) * sScale, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════
// BG PREVIEW
// ═══════════════════════════════════════
let bgPreviewTimer = null;
function showBgPreview(type) {
  const wrap = DC.parentElement;
  const pc = document.getElementById('bg-preview-canvas');
  pc.width = wrap.clientWidth; pc.height = wrap.clientHeight;
  const pctx = pc.getContext('2d');
  const prev = bgType; bgType = type;
  drawBgOn(pctx, pc.width, pc.height, pc.height * 0.82, 1, pc.width / 2, 0);
  bgType = prev;
  const labels = { sky:'🌤 하늘', night:'🌙 밤', ocean:'🌊 바다', space:'🌌 우주',
                    classroom:'🏫 교실', park:'🌳 공원', home:'🏠 집' };
  document.getElementById('bg-preview-label').textContent = labels[type];
  const el = document.getElementById('bg-preview');
  el.classList.remove('hide'); el.style.display = 'flex';
  if (bgPreviewTimer) clearTimeout(bgPreviewTimer);
  bgPreviewTimer = setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => { el.style.display = 'none'; el.classList.remove('hide'); }, 300);
  }, 1200);
}

// ═══════════════════════════════════════
// PHYSICS (GSAP easing + animation principles)
// ═══════════════════════════════════════
// Cache GSAP easing functions
const E = {};
function ease(name) {
  if (!E[name]) E[name] = (typeof gsap !== 'undefined') ? gsap.parseEase(name) : (t => t);
  return E[name];
}

function getPhysics(t, m) {
  const H = AC.height;
  const gY = H * (bgType === 'space' ? 0.85 : 0.82);
  let y = gY, sx = 1, sy = 1, rot = 0;
  const iv = intensity;

  if (m === 'walk') {
    // ── Walk: 발걸음 주기 (push-off → airborne → contact → support) ──
    const speed = 3.0 + iv * 3.5;
    const period = (2 * Math.PI) / speed;
    const phase = ((t % period) / period);  // 0→1 per step

    let air, squash;
    if (phase < 0.15) {
      // Push-off: 발 구르기 (약간 쭈그러듦 → 발사)
      const p = phase / 0.15;
      squash = ease('power2.out')(1 - p) * 0.4;
      air = ease('power3.out')(p) * 0.3;
    } else if (phase < 0.50) {
      // Airborne: 공중 (올라가다 내려오기)
      const p = (phase - 0.15) / 0.35;
      const arc = 1 - (2 * p - 1) ** 2; // parabolic arc
      air = 0.3 + ease('power2.out')(arc) * 0.7;
      squash = -air * 0.15; // stretch in air (negative squash)
    } else if (phase < 0.70) {
      // Contact: 착지 충격 (강한 squash)
      const p = (phase - 0.50) / 0.20;
      air = ease('power3.in')(1 - p) * 0.3;
      squash = ease('back.out(3)')(p) * 0.45;
    } else {
      // Support: 회복 (원상복구 with overshoot)
      const p = (phase - 0.70) / 0.30;
      air = 0;
      squash = ease('power2.out')(1 - p) * 0.15;
    }

    y = gY - air * H * 0.25 * iv;
    sx = 1 + squash * iv;
    sy = 1 - squash * 0.8 * iv;
    // 이동 방향으로 기울어짐 + 발걸음 리듬
    rot = (Math.sin(phase * Math.PI * 2) * 0.14 + (charVx > 0 ? 0.06 : -0.06)) * iv;

  } else if (m === 'jump') {
    // ── Jump: 본격 점프 (anticipation → launch → peak → fall → impact → recovery) ──
    const freq = 0.8 + iv * 2.2;
    const period = (2 * Math.PI) / freq;
    const phase = ((t % period) / period);

    let air = 0;
    if (phase < 0.10) {
      // Anticipation: 웅크리기
      const p = ease('power2.in')(phase / 0.10);
      sx = 1 + p * 0.55 * iv;
      sy = 1 - p * 0.45 * iv;
      air = 0;
    } else if (phase < 0.18) {
      // Launch: 폭발적으로 뛰어오르기
      const p = ease('power4.out')((phase - 0.10) / 0.08);
      air = p * 0.55;
      sx = 1 - p * 0.15 * iv;
      sy = 1 + p * 0.45 * iv;
    } else if (phase < 0.48) {
      // Rise: 감속하며 올라감
      const p = ease('power2.out')((phase - 0.18) / 0.30);
      air = 0.55 + p * 0.45;
      sx = 1 - air * 0.12 * iv;
      sy = 1 + air * 0.38 * iv;
    } else if (phase < 0.54) {
      // Peak: 정점 체공 (미세한 회전)
      air = 1;
      sx = 1 - 0.08 * iv;
      sy = 1 + 0.22 * iv;
    } else if (phase < 0.82) {
      // Fall: 가속하며 떨어짐
      const p = ease('power3.in')((phase - 0.54) / 0.28);
      air = 1 - p;
      sx = 1 - (1 - p) * 0.10 * iv;
      sy = 1 + (1 - p) * 0.35 * iv;
    } else if (phase < 0.91) {
      // Impact: 착지 충격 (강한 squash)
      const p = ease('power2.out')((phase - 0.82) / 0.09);
      air = 0;
      sx = 1 + p * 0.75 * iv;
      sy = 1 - p * 0.60 * iv;
    } else {
      // Recovery: 스프링 반동으로 복구 (overshoot!)
      const p = ease('back.out(2.5)')((phase - 0.91) / 0.09);
      air = 0;
      sx = 1 + (1 - p) * 0.75 * iv;
      sy = 1 - (1 - p) * 0.60 * iv;
    }

    y = gY - air * H * 0.88 * iv;
    rot = Math.sin(phase * Math.PI * 2) * 0.22 * iv;
    // Peak에서 한바퀴 회전 느낌
    if (phase > 0.30 && phase < 0.70) {
      const spinP = (phase - 0.30) / 0.40;
      rot += Math.sin(spinP * Math.PI) * 0.35 * iv;
    }

  } else if (m === 'excited') {
    // ── Excited: 미친듯이 빠르게 (elastic bounce + wild wobble) ──
    const speed = 9.0 + iv * 4;
    const period = (2 * Math.PI) / speed;
    const phase = ((t % period) / period);

    let air;
    if (phase < 0.45) {
      // Bounce up (빠르게 올라감)
      const p = ease('power2.out')(phase / 0.45);
      air = p;
    } else if (phase < 0.55) {
      // Peak (짧은 체공)
      air = 1;
    } else if (phase < 0.85) {
      // Fall (빠르게 내려옴)
      const p = ease('power3.in')((phase - 0.55) / 0.30);
      air = 1 - p;
    } else {
      // Elastic landing
      const p = (phase - 0.85) / 0.15;
      air = 0;
      const bounce = ease('elastic.out(1,0.3)')(p);
      sx = 1 + (1 - bounce) * 0.5 * iv;
      sy = 1 - (1 - bounce) * 0.4 * iv;
    }

    y = gY - air * H * 0.45 * iv;
    // Wild wiggle
    const wiggle = Math.sin(t * 16) * 0.32 * iv;
    sx = (sx === 1 ? 1 : sx) + (air > 0.1 ? wiggle * 0.3 : 0);
    sy = sy === 1 ? 1 - air * 0.25 * iv + (1 - air) * 0.12 * iv : sy;
    rot = Math.sin(t * 13) * 0.38 * iv + Math.cos(t * 7) * 0.12 * iv;
  }
  return { y, sx, sy, rot, gY };
}

// ═══════════════════════════════════════
// LIMB PHYSICS (애니메이션 시 팔다리 흔들기)
// ═══════════════════════════════════════
function getLimbPhysics(time, m) {
  const iv = intensity;
  const base = { ...limbAngles };

  if (m === 'walk') {
    const speed = 3.0 + iv * 3.5;
    const swing = Math.sin(time * speed) * 0.6 * iv;
    base.armL = (limbAngles.armL || 0) + swing;
    base.armR = (limbAngles.armR || 0) - swing;
    base.legL = (limbAngles.legL || 0) - swing * 0.7;
    base.legR = (limbAngles.legR || 0) + swing * 0.7;
  } else if (m === 'jump') {
    const freq = 0.8 + iv * 2.2;
    const period = (2 * Math.PI) / freq;
    const phase = ((time % period) / period);
    const lift = Math.sin(phase * Math.PI) * 1.0 * iv;
    base.armL = (limbAngles.armL || 0) - lift;
    base.armR = (limbAngles.armR || 0) + lift;
    base.legL = (limbAngles.legL || 0) + lift * 0.3;
    base.legR = (limbAngles.legR || 0) - lift * 0.3;
  } else if (m === 'excited') {
    const swing = Math.sin(time * 12) * 0.8 * iv;
    const swing2 = Math.cos(time * 9) * 0.5 * iv;
    base.armL = (limbAngles.armL || 0) + swing;
    base.armR = (limbAngles.armR || 0) - swing;
    base.legL = (limbAngles.legL || 0) - swing2;
    base.legR = (limbAngles.legR || 0) + swing2;
  }
  return base;
}

function drawAnimLimb(ctx, name, limb, physics) {
  ctx.save();
  // 팔다리 위치를 body bounds 기준으로 계산
  const b = spriteBounds;
  const offsetX = limb.pivot.x;
  const offsetY = limb.pivot.y - b.h / 2;
  ctx.translate(offsetX, offsetY);
  ctx.rotate(physics[name] || 0);
  limb.draw(ctx);
  ctx.restore();
}

// ═══════════════════════════════════════
// EMOTION INDICATORS
// ═══════════════════════════════════════
function drawEmotion(ctx, x, y, m, time) {
  const fs = Math.round(AC.height * 0.065);
  ctx.font = `${fs}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.75;

  if (m === 'walk') {
    const ny = y - 45 + Math.sin(time * 3) * 8;
    const nx = x + (charVx > 0 ? 28 : -28);
    ctx.fillText('🎵', nx, ny);
  } else if (m === 'jump') {
    const gY = AC.height * 0.82;
    if (y < gY - AC.height * 0.25) {
      ctx.fillText('⭐', x + 22 + Math.sin(time*4)*5, y - 8);
    }
  } else if (m === 'excited') {
    ctx.fillText('💕', x + Math.sin(time*5)*18, y - 35 + Math.cos(time*7)*8);
    ctx.font = `${Math.round(fs * 0.8)}px sans-serif`;
    ctx.fillText('⭐', x - Math.cos(time*4)*22, y - 15 + Math.sin(time*6)*10);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start';
}

// ═══════════════════════════════════════
// ANIMATION LOOP (delta time)
// ═══════════════════════════════════════
function animLoop(timestamp) {
  const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
  lastTime = timestamp;
  t += dt;

  actx.clearRect(0, 0, AC.width, AC.height);

  if (mode !== 'jump') {
    const spd = (mode === 'walk' ? 2.2 : 4.5) * (0.3 + intensity * 0.7);
    charX += charVx * spd * (dt / 0.016);
    if (charX < 50) { charX = 50; charVx = Math.abs(charVx); }
    if (charX > AC.width - 50) { charX = AC.width - 50; charVx = -Math.abs(charVx); }
  }

  const { y, sx, sy, rot, gY } = getPhysics(t, mode);
  drawBg(y, sx);

  // 사운드 감지
  const inAir = y < gY - 8;
  if (!wasInAir && inAir) playSound('boing');
  if (wasInAir && !inAir) playSound('thud');
  if (!inAir && mode !== 'jump') {
    const interval = mode === 'excited' ? 0.18 : 0.3;
    if (t - lastStepT > interval) { playSound('step'); lastStepT = t; }
  }
  wasInAir = inAir;

  // 스프라이트 그리기 (캐시 사용)
  if (!spriteCache) updateSpriteCache();
  const b = spriteBounds;
  const parts = CHARACTER_PARTS[currentChar];

  // 눈 깜빡임 업데이트
  blinkTimer += dt;
  if (blinkState === 'open' && blinkTimer > 2.5 + Math.random() * 2) {
    blinkState = 'closed'; blinkTimer = 0;
  } else if (blinkState === 'closed' && blinkTimer > 0.15) {
    blinkState = 'open'; blinkTimer = 0;
  }

  // 팔다리 물리
  const limbPhys = getLimbPhysics(t, mode);

  actx.save();
  actx.translate(charX, y);
  actx.rotate(rot);
  actx.scale(charVx < 0 ? -sx : sx, sy);

  // 뒤쪽 팔다리
  if (parts) {
    for (const [name, limb] of Object.entries(parts.limbs)) {
      if (limb.zBehind) drawAnimLimb(actx, name, limb, limbPhys);
    }
  }

  // 몸통 스프라이트
  actx.drawImage(spriteCache, -b.w / 2, -b.h, b.w, b.h);

  // 눈 (깜빡임)
  if (parts) {
    const ecx = 0, ecy = -b.h / 2;
    if (blinkState === 'closed') {
      parts.eyes.closed(actx, ecx, ecy);
    } else {
      parts.eyes.open(actx, ecx, ecy);
    }
  }

  // 앞쪽 팔다리
  if (parts) {
    for (const [name, limb] of Object.entries(parts.limbs)) {
      if (!limb.zBehind) drawAnimLimb(actx, name, limb, limbPhys);
    }
  }

  actx.restore();

  // 감정 이모션
  drawEmotion(actx, charX, y, mode, t);

  animRAF = requestAnimationFrame(animLoop);
}

function setMode(m, el, label) {
  mode = m; spriteBounds = null; spriteCache = null;
  if (m === 'jump') charX = AC.width / 2;
  wasInAir = false; lastStepT = t;
  document.querySelectorAll('.mbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mode-label').textContent = label;
  playSound('sparkle');
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
loadChar('cat', document.querySelector('.cbtn'));

// ═══════════════════════════════════════
// Fullscreen + Landscape Lock
// ═══════════════════════════════════════
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      try { screen.orientation.lock('landscape').catch(() => {}); } catch(e) {}
    }).catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// 자동으로 가로 잠금 시도
try {
  screen.orientation.lock('landscape').catch(() => {});
} catch(e) {}

// ═══════════════════════════════════════
// PWA Service Worker
// ═══════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ═══════════════════════════════════════
// PWA Install Prompt
// ═══════════════════════════════════════
let deferredPrompt = null;
const installBanner = document.getElementById('install-banner');
const installGuide = document.getElementById('install-guide');

// 플랫폼 감지
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (!isStandalone && !localStorage.getItem('install-dismissed')) {
    installBanner.classList.add('show');
  }
}

setTimeout(() => {
  if (!deferredPrompt) showInstallBanner();
}, 1500);

function doInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      installBanner.classList.remove('show');
    });
  } else {
    showInstallGuide();
  }
}

function showInstallGuide() {
  installBanner.classList.remove('show');
  // 플랫폼에 맞는 가이드 표시
  const iosSection = document.getElementById('guide-ios');
  const androidSection = document.getElementById('guide-android');
  if (isIOS) {
    iosSection.classList.add('active');
    androidSection.classList.remove('active');
  } else if (isAndroid) {
    androidSection.classList.add('active');
    iosSection.classList.remove('active');
  } else {
    // 데스크톱 등 - 둘 다 표시
    iosSection.classList.add('active');
    androidSection.classList.add('active');
  }
  installGuide.classList.add('show');
}

function closeGuide(e) {
  if (!e || e.target === installGuide || e.target.classList.contains('guide-close')) {
    installGuide.classList.remove('show');
  }
}

function dismissInstall() {
  installBanner.classList.remove('show');
  localStorage.setItem('install-dismissed', '1');
}

window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('show');
  deferredPrompt = null;
});
