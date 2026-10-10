'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'portfolio:language-switch';

/** After a language switch, put the visitor back where they were. */
export function ScrollRestore() {
  useEffect(() => {
    let saved: { id: string; offset: number; at: number } | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      return;
    }
    if (!saved || Date.now() - saved.at > 15_000) return;
    const { id, offset } = saved;

    const restore = () => {
      const section =
        id === 'hero'
          ? document.querySelector<HTMLElement>('[data-hero]')
          : document.getElementById(id);
      if (!section) return;
      const line = window.innerHeight * 0.35;
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(top + offset - line, 0), behavior: 'instant' });
    };

    // Once now, and again when fonts and images have settled the layout.
    restore();
    if (document.readyState !== 'complete') {
      window.addEventListener('load', restore, { once: true });
    }
    void document.fonts?.ready.then(restore);
  }, []);

  return null;
}
