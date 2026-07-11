'use client';

/**
 * Ruban d'encre vivante — portage direct de la boucle canvas du prototype.
 * rAF unique, canvas en devicePixelRatio, deux passes (nappe floue + filament).
 * Motion ne touche jamais à ce rendu (périmètre interdit, §2 du brief).
 */

import { useEffect, useRef } from 'react';
import { angleOf, opOf, type RGB } from '@/lib/ink';
import styles from './dial.module.css';

export interface InkRingProps {
  colors: RGB[]; // couleur lissée par jour de cycle
  L: number;
  SD: number;
  todayDay: number | null; // null : pas d'aiguille ni de goutte (découverte)
  reduced: boolean;
  fadeWindow: boolean; // estomper l'encre dans la fenêtre d'incertitude
}

export function InkRing({ colors, L, SD, todayDay, reduced, fadeWindow }: InkRingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ colors, L, SD, todayDay, reduced, fadeWindow });
  propsRef.current = { colors, L, SD, todayDay, reduced, fadeWindow };
  const kickRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext('2d');
    if (!ctx) return;

    let S = 0;
    let raf = 0;
    let disposed = false;

    // La nappe floue est rendue AVEC le blur par trait du prototype (rendu
    // identique au pixel près), mais dans un offscreen rafraîchi à cadence
    // adaptative (~15 fps, contingence §6) : 240 traits filtrés par frame
    // écrouleraient les 60 fps. Le filament net, l'aiguille et la goutte
    // restent à 60 fps sur le canvas principal.
    const nappe = document.createElement('canvas');
    const nappeCtx = nappe.getContext('2d');
    if (!nappeCtx) return;
    let nappeTT = Number.NaN; // phase d'ondulation du dernier rendu de nappe
    let nappeInterval = 66; // ms — 15 fps, élargi si l'appareil est lent
    let lastNappeAt = -Infinity;
    // le coût réel du blur est payé à la rasterisation (différée) : on jauge
    // la lenteur de l'appareil sur le delta de frame qui SUIT un rendu de nappe
    let nappeJustRendered = false;
    let lastFrameT = 0;

    const sizeCanvas = (): void => {
      const rect = cnv.getBoundingClientRect();
      S = rect.width;
      cnv.width = S * devicePixelRatio;
      cnv.height = S * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      nappe.width = cnv.width;
      nappe.height = cnv.height;
      nappeCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      nappeTT = Number.NaN; // le contenu offscreen est perdu au resize
    };

    const render = (t: number): void => {
      if (disposed) return;
      const { colors: cols, L, SD, todayDay, reduced, fadeWindow } = propsRef.current;
      ctx.clearRect(0, 0, S, S);
      const cx = S / 2;
      const cy = S / 2;
      const R = S * 0.37;
      const N = 240; // résolution du ruban
      const tt = reduced ? 0 : t * 0.00022;

      // deux passes du prototype : nappe floue (offscreen, blur par trait,
      // rafraîchie à ~15 fps) puis filament net à 60 fps
      const drawPass = (target: CanvasRenderingContext2D, pass: 0 | 1, passTT: number): void => {
        for (let i = 0; i < N; i++) {
          const day = (i / N) * L;
          const a1 = angleOf(day, L);
          const a2 = angleOf(day + L / N + 0.004, L);
          // ondulation organique : rayon et épaisseur respirent lentement
          const und =
            Math.sin(a1 * 3 + passTT * 2) * S * 0.012 + Math.sin(a1 * 5 - passTT * 1.3) * S * 0.007;
          const r = R + (pass === 0 ? und * 1.4 : und);
          const w =
            (pass === 0 ? S * 0.075 : S * 0.02) * (1 + 0.22 * Math.sin(a1 * 4 + passTT * 1.7));
          const ci = Math.min(L - 1, Math.floor(day));
          const c = cols[ci] ?? ([141, 127, 136] as RGB);
          const o = (fadeWindow ? opOf(ci + 1, L, SD) : 1) * (pass === 0 ? 0.5 : 0.95);
          const bright = pass === 1 ? 1.28 : 1;
          target.beginPath();
          target.arc(cx, cy, r, a1, a2 + 0.01);
          target.strokeStyle = `rgba(${Math.min(255, c[0] * bright) | 0},${Math.min(255, c[1] * bright) | 0},${Math.min(255, c[2] * bright) | 0},${o})`;
          target.lineWidth = w;
          target.lineCap = 'round';
          target.stroke();
        }
      };

      if (nappeJustRendered) {
        // appareil lent : espacer les rendus de nappe pour ne jamais affamer
        // l'event loop (l'ondulation ralentit, le filament reste fluide)
        nappeInterval = Math.max(66, (t - lastFrameT) * 6);
        nappeJustRendered = false;
      }
      if (Number.isNaN(nappeTT) || (!reduced && t - lastNappeAt >= nappeInterval)) {
        nappeCtx.clearRect(0, 0, S, S);
        nappeCtx.save();
        nappeCtx.filter = `blur(${S * 0.045}px)`;
        drawPass(nappeCtx, 0, tt);
        nappeCtx.restore();
        nappeTT = tt;
        lastNappeAt = t;
        nappeJustRendered = true;
      }
      ctx.drawImage(nappe, 0, 0, S, S);
      drawPass(ctx, 1, tt);
      lastFrameT = t;

      if (todayDay !== null) {
        // aiguille hairline + goutte « aujourd'hui » qui respire
        const day = Math.min(todayDay, L); // en retard : la goutte reste en bout de cadran
        const a = angleOf(day - 0.5, L);
        const und = Math.sin(a * 3 + tt * 2) * S * 0.012 + Math.sin(a * 5 - tt * 1.3) * S * 0.007;
        const px = cx + (R + und) * Math.cos(a);
        const py = cy + (R + und) * Math.sin(a);
        const puls = reduced ? 0 : (Math.sin(t * 0.0014) + 1) / 2;
        ctx.beginPath();
        ctx.moveTo(cx + S * 0.09 * Math.cos(a), cy + S * 0.09 * Math.sin(a));
        ctx.lineTo(px - S * 0.02 * Math.cos(a), py - S * 0.02 * Math.sin(a));
        ctx.strokeStyle = 'rgba(241,232,226,.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.save();
        ctx.filter = `blur(${S * 0.02}px)`;
        ctx.beginPath();
        ctx.arc(px, py, S * 0.028 + puls * S * 0.012, 0, 7);
        ctx.fillStyle = `rgba(255,250,244,${0.5 + puls * 0.25})`;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(px, py, S * 0.011, 0, 7);
        ctx.fillStyle = '#fdf8f1';
        ctx.fill();
      }

      if (!propsRef.current.reduced) raf = requestAnimationFrame(render);
    };

    const start = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    // un changement de données doit invalider la nappe pré-rendue
    kickRef.current = () => {
      nappeTT = Number.NaN;
      start();
    };

    sizeCanvas();
    start();

    // en mode réduit le rAF ne boucle pas : redessiner une frame statique au resize
    const observer = new ResizeObserver(() => {
      sizeCanvas();
      start();
    });
    observer.observe(cnv);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // en mode réduit le rAF ne boucle pas : rejouer une frame statique à chaque
  // changement de données (et au passage animé ↔ réduit)
  useEffect(() => {
    kickRef.current();
  }, [colors, L, SD, todayDay, reduced, fadeWindow]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
