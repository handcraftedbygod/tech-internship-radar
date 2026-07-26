(function () {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const header = canvas.parentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let particles = [];
  let raf = null;
  let color = "#8a90a0";

  function readColor() {
    color = getComputedStyle(document.documentElement).getPropertyValue("--particle").trim() || color;
  }
  readColor();
  new MutationObserver(readColor).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  function makeParticles() {
    const count = Math.max(70, Math.min(220, Math.round((width * height) / 5500)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.14,
      vy: (Math.random() - 0.5) * 0.14,
      r: Math.random() * 1.5 + 0.6,
      baseAlpha: Math.random() * 0.45 + 0.25,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  const ring = { cx: 0, cy: 0, r: 0, angle: 0, pulse: 0 };

  function layoutRing() {
    ring.cx = width * 0.86;
    ring.cy = height * 0.28;
    ring.r = Math.min(width, height) * 0.42;
  }

  function resize() {
    const rect = header.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeParticles();
    layoutRing();
  }

  function drawRing() {
    const { cx, cy, r } = ring;
    if (r <= 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;

    [1, 0.64, 0.3].forEach((f, i) => {
      ctx.globalAlpha = 0.38 - i * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.fill();

    const angle = reduceMotion.matches ? -Math.PI / 4 : ring.angle;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.stroke();

    if (!reduceMotion.matches) {
      const t = ring.pulse % 1;
      ctx.globalAlpha = Math.max(0, 0.32 * (1 - t));
      ctx.beginPath();
      ctx.arc(cx, cy, t * r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles(t) {
    ctx.save();
    ctx.fillStyle = color;
    for (const p of particles) {
      if (!reduceMotion.matches) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        if (p.y > height + 5) p.y = -5;
      }
      const twinkle = reduceMotion.matches ? 0 : Math.sin(t / 900 + p.twinkle) * 0.15;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.baseAlpha + twinkle));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function frame(t) {
    ctx.clearRect(0, 0, width, height);
    drawParticles(t);
    drawRing();
    if (!reduceMotion.matches) {
      ring.angle += 0.0025;
      ring.pulse += 0.0026;
      raf = requestAnimationFrame(frame);
    }
  }

  function start() {
    cancelAnimationFrame(raf);
    frame(performance.now());
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = null;
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (!document.hidden) start();
    }, 150);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", start);
  }

  resize();
  start();
})();
