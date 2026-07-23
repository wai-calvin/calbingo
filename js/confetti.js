/* ============================================================================
 * CalBingo — Confetti
 * A tiny, dependency-free confetti burst drawn on a full-screen <canvas>.
 * Call CalBingoConfetti.fire() to celebrate. No external network calls.
 * ==========================================================================*/
(function () {
  "use strict";

  const COLORS = ["#f6b52c", "#2f74c0", "#2ea3a3", "#7b3f6f", "#f4ede0"];

  let canvas, ctx, pieces = [], raf = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(count) {
    const W = window.innerWidth;
    for (let i = 0; i < count; i++) {
      pieces.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.6,
        y: -20 - Math.random() * 120,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const H = window.innerHeight;
    pieces.forEach((p) => {
      p.vy += 0.08;               // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H * 0.75) p.life -= 0.02;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    pieces = pieces.filter((p) => p.life > 0 && p.y < H + 40);
    if (pieces.length > 0) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      raf = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function fire() {
    ensureCanvas();
    spawn(160);
    // Two quick follow-up bursts for a fuller effect.
    setTimeout(() => spawn(80), 180);
    setTimeout(() => spawn(80), 360);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  window.CalBingoConfetti = { fire };
})();
