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

    // La nappe floue est dessinée non filtrée dans un offscreen puis composée
    // avec UN seul blur par frame : 240 blurs/frame tueraient les 60 fps sur
    // mobile milieu de gamme (contingence prévue au §6 du brief).
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');
    if (!offCtx) return;

    const sizeCanvas = (): void => {
      const rect = cnv.getBoundingClientRect();
      S = rect.width;
      cnv.width = S * devicePixelRatio;
      cnv.height = S * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      off.width = cnv.width;
      off.height = cnv.height;
      offCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
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

      // deux passes : nappe floue (offscreen + blur unique) puis filament net
      offCtx.clearRect(0, 0, S, S);
      for (const pass of [0, 1]) {
        const target = pass === 0 ? offCtx : ctx;
        for (let i = 0; i < N; i++) {
          const day = (i / N) * L;
          const a1 = angleOf(day, L);
          const a2 = angleOf(day + L / N + 0.004, L);
          // ondulation organique : rayon et épaisseur respirent lentement
          const und = Math.sin(a1 * 3 + tt * 2) * S * 0.012 + Math.sin(a1 * 5 - tt * 1.3) * S * 0.007;
          const r = R + (pass === 0 ? und * 1.4 : und);
          const w = (pass === 0 ? S * 0.075 : S * 0.02) * (1 + 0.22 * Math.sin(a1 * 4 + tt * 1.7));
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
        if (pass === 0) {
          ctx.save();
          ctx.filter = `blur(${S * 0.045}px)`;
          ctx.drawImage(off, 0, 0, S, S);
          ctx.restore();
        }
      }

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
    kickRef.current = start;

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
