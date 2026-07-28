// Dotwork globe artwork — ported literally from the design reference's
// drawGlobe() (Tech Internship Radar.dc.html). Plain Canvas 2D, deterministic
// dither via hash(x, y) so the pattern is stable frame to frame.
(function () {
  const canvas = document.getElementById("globe-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const dotIntensity = 1; // matches the design's default prop value

  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function drawGlobe(t) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 0;
    if (!size) return;
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const k = dotIntensity;
    const cx = size / 2, cy = size / 2, R = size * 0.235;
    ctx.fillStyle = "#F4F7F9";

    // radiating dotwork rays
    const rays = 168;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const m = 0.5 + 0.5 * Math.sin(a * 5 + t * 0.35) * Math.cos(a * 2 - t * 0.18);
      const len = R * (1.22 + m * 1.55);
      const start = R * 1.1;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let r = start; r < len; r += 3.1) {
        const f = 1 - (r - start) / (len - start);
        const p = Math.pow(f, 1.5) * (0.3 + m * 0.8) * k;
        if (hash(i * 3.7, r) < p) {
          const s = f > 0.72 ? 1.7 : 1.1;
          ctx.fillRect(cx + ca * r, cy + sa * r, s, s);
        }
      }
    }

    // dotted orbits
    ctx.globalAlpha = 0.4;
    [1.06, 1.62, 2.05].forEach((mul, oi) => {
      const rr = R * mul;
      const steps = Math.round(rr * 1.5);
      for (let i = 0; i < steps; i++) {
        if (i % (oi === 0 ? 2 : 3) !== 0) continue;
        const a = (i / steps) * Math.PI * 2 + t * (oi === 1 ? 0.05 : -0.03);
        ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1, 1);
      }
    });
    ctx.globalAlpha = 1;

    // halftone sphere, rotating
    const lx = -0.52, ly = -0.62, lz = 0.58;
    const ln = Math.sqrt(lx * lx + ly * ly + lz * lz);
    for (let lat = -88; lat <= 88; lat += 2.1) {
      const rad = (lat * Math.PI) / 180;
      const cl = Math.cos(rad), sl = Math.sin(rad);
      const step = 2.1 / Math.max(0.18, cl);
      for (let lon = 0; lon < 360; lon += step) {
        const lr = (lon * Math.PI) / 180 + t * 0.14;
        const nx = cl * Math.sin(lr), ny = sl, nz = cl * Math.cos(lr);
        if (nz <= 0.02) continue;
        let lum = (nx * lx + ny * ly + nz * lz) / ln;
        lum = Math.max(0, lum) * 0.92 + Math.pow(1 - nz, 2.4) * 0.5;
        lum = Math.min(1, lum);
        const th = hash(lat * 7.3, lon * 1.9);
        if (lum * k < th * 0.95) continue;
        const s = lum > 0.72 ? 2 : lum > 0.42 ? 1.5 : 1;
        ctx.fillRect(cx + nx * R, cy + ny * R, s, s);
      }
    }

    // satellite
    const sa2 = t * 0.42;
    const sx = cx + Math.cos(sa2) * R * 1.62, sy = cy + Math.sin(sa2) * R * 1.62 * 0.42;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  let raf = null;
  let t = 0;
  let last = null;

  function loop(now) {
    raf = null;
    if (last == null) last = now;
    const dt = Math.min(48, now - last);
    last = now;
    t += dt / 1000;
    drawGlobe(t);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (raf) return;
    if (reduceMotion.matches) {
      // draw a single static frame instead of looping
      drawGlobe(0);
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    last = null;
  }

  const ro = new ResizeObserver(() => {
    if (canvas.clientWidth === 0) return;
    if (reduceMotion.matches) drawGlobe(t);
  });
  ro.observe(canvas);

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", () => {
      stop();
      start();
    });
  }

  window.addEventListener("beforeunload", stop);

  start();
})();
