import { useTheme } from "@/lib/theme-context";
import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────
   LIGHT THEME  →  Floating Bubbles Canvas
───────────────────────────────────────── */
function BubblesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Bubble palette for light mode
    const palette = [
      "rgba(99,102,241,",   // indigo
      "rgba(139,92,246,",   // violet
      "rgba(236,72,153,",   // pink
      "rgba(59,130,246,",   // blue
      "rgba(16,185,129,",   // emerald
      "rgba(251,146,60,",   // orange
    ];

    interface Bubble {
      x: number; y: number; r: number;
      dx: number; dy: number;
      color: string; alpha: number;
      alphaDir: number;
    }

    const bubbles: Bubble[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 24 + Math.random() * 80,
      dx: (Math.random() - 0.5) * 0.55,
      dy: -0.3 - Math.random() * 0.5,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.08 + Math.random() * 0.15,
      alphaDir: Math.random() > 0.5 ? 1 : -1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubbles.forEach((b) => {
        // Pulse alpha
        b.alpha += b.alphaDir * 0.0008;
        if (b.alpha > 0.22 || b.alpha < 0.04) b.alphaDir *= -1;

        // Gradient fill
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        grad.addColorStop(0, b.color + (b.alpha + 0.08) + ")");
        grad.addColorStop(0.6, b.color + b.alpha + ")");
        grad.addColorStop(1, b.color + "0)");
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Glass rim
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = b.color + "0.25)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Highlight
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fill();

        b.x += b.dx;
        b.y += b.dy;

        if (b.y + b.r < 0) {
          b.y = canvas.height + b.r;
          b.x = Math.random() * canvas.width;
        }
        if (b.x + b.r < 0) b.x = canvas.width + b.r;
        if (b.x - b.r > canvas.width) b.x = -b.r;
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}

/* ─────────────────────────────────────────
   DARK THEME  →  Revolving Atom Structure
───────────────────────────────────────── */
function AtomBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Multiple atom systems scattered across the canvas
    interface AtomSystem {
      cx: number; cy: number;
      nucleusR: number;
      orbitCount: number;
      baseSpeed: number;
      tilt: number[];
      color: string;
      glowColor: string;
    }

    const systems: AtomSystem[] = [
      {
        cx: 0.5, cy: 0.5, nucleusR: 10, orbitCount: 3,
        baseSpeed: 1, tilt: [0, Math.PI / 3, -Math.PI / 3],
        color: "#22d3ee", glowColor: "rgba(34,211,238,",
      },
      {
        cx: 0.12, cy: 0.2, nucleusR: 5, orbitCount: 2,
        baseSpeed: 1.4, tilt: [Math.PI / 5, -Math.PI / 4],
        color: "#a78bfa", glowColor: "rgba(167,139,250,",
      },
      {
        cx: 0.88, cy: 0.18, nucleusR: 4, orbitCount: 2,
        baseSpeed: 0.9, tilt: [Math.PI / 6, Math.PI / 2],
        color: "#34d399", glowColor: "rgba(52,211,153,",
      },
      {
        cx: 0.1, cy: 0.82, nucleusR: 5, orbitCount: 2,
        baseSpeed: 1.1, tilt: [0, Math.PI / 3],
        color: "#f472b6", glowColor: "rgba(244,114,182,",
      },
      {
        cx: 0.9, cy: 0.78, nucleusR: 4, orbitCount: 2,
        baseSpeed: 1.3, tilt: [Math.PI / 4, -Math.PI / 4],
        color: "#fb923c", glowColor: "rgba(251,146,60,",
      },
    ];

    const drawGlow = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color + alpha + ")");
      g.addColorStop(1, color + "0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawOrbit = (
      cx: number, cy: number, rx: number, ry: number,
      tilt: number, color: string
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = color.replace(",", ",").replace("rgba", "rgba").replace(")","") + "";
      // Use the color directly but at low opacity
      ctx.strokeStyle = color + "38";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    };

    const drawElectron = (
      cx: number, cy: number, rx: number, ry: number,
      tilt: number, angle: number, color: string, glowColor: string, eR: number
    ) => {
      // Parametric point on the ellipse
      const ex = cx + Math.cos(tilt) * rx * Math.cos(angle) - Math.sin(tilt) * ry * Math.sin(angle);
      const ey = cy + Math.sin(tilt) * rx * Math.cos(angle) + Math.cos(tilt) * ry * Math.sin(angle);

      // Glow
      drawGlow(ex, ey, eR * 6, glowColor, 0.3);

      // Core
      ctx.beginPath();
      ctx.arc(ex, ey, eR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // White shimmer
      ctx.beginPath();
      ctx.arc(ex - eR * 0.3, ey - eR * 0.3, eR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fill();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.012;

      const W = canvas.width;
      const H = canvas.height;

      systems.forEach((sys) => {
        const cx = sys.cx * W;
        const cy = sys.cy * H;
        const scale = Math.min(W, H) * (sys.nucleusR === 10 ? 0.18 : 0.09);
        const nr = sys.nucleusR;

        // Nucleus glow
        drawGlow(cx, cy, nr * 8, sys.glowColor, 0.4);

        // Nucleus core
        const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr);
        ng.addColorStop(0, "#fff");
        ng.addColorStop(0.4, sys.color);
        ng.addColorStop(1, sys.glowColor + "0.4)");
        ctx.beginPath();
        ctx.arc(cx, cy, nr, 0, Math.PI * 2);
        ctx.fillStyle = ng;
        ctx.shadowBlur = 30;
        ctx.shadowColor = sys.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Orbits & electrons
        sys.tilt.forEach((tiltAngle, idx) => {
          const rx = scale * (0.9 + idx * 0.05);
          const ry = rx * 0.38;
          const finalTilt = tiltAngle;
          const speed = sys.baseSpeed * (0.7 + idx * 0.3);
          const electronAngle = t * speed + (idx * Math.PI * 2) / sys.orbitCount;
          const eR = nr * 0.45;

          drawOrbit(cx, cy, rx, ry, finalTilt, sys.color);
          drawElectron(cx, cy, rx, ry, finalTilt, electronAngle, sys.color, sys.glowColor, eR);

          // Second electron on same orbit (opposite side) for large atom
          if (sys.nucleusR === 10) {
            drawElectron(cx, cy, rx, ry, finalTilt, electronAngle + Math.PI, sys.color, sys.glowColor, eR * 0.7);
          }
        });
      });

      // Subtle grid of connecting lines between systems (at very low opacity)
      ctx.save();
      ctx.globalAlpha = 0.04;
      for (let i = 0; i < systems.length; i++) {
        for (let j = i + 1; j < systems.length; j++) {
          const x1 = systems[i].cx * W, y1 = systems[i].cy * H;
          const x2 = systems[j].cx * W, y2 = systems[j].cy * H;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}

/* ─────────────────────────────────────────
   Export: picks the right bg by theme
───────────────────────────────────────── */
export function AnimatedBackground() {
  const { theme } = useTheme();
  return theme === "dark" ? <AtomBackground /> : <BubblesBackground />;
}
