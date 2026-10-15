'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type View = 'design' | 'numbers';

/**
 * Evolution tells two things, the design (the comparer) and the numbers (the archive of versions), and
 * does not fit both on one screen, so a pair of tabs shows one at a time. The design comes first. Without
 * script both panels are shown (a `noscript` rule in the page). The numbers panel is marked `data-in`
 * while it is on screen and the section has arrived, so the figures count up each time it is opened.
 */
export function EvolutionPanels({
  labels,
  design,
  numbers,
}: {
  labels: { group: string; design: string; numbers: string };
  design: ReactNode;
  numbers: ReactNode;
}) {
  const [view, setView] = useState<View>('design');
  const root = useRef<HTMLDivElement>(null);
  const numbersPanel = useRef<HTMLDivElement>(null);
  const tabs = useRef<Record<View, HTMLButtonElement | null>>({ design: null, numbers: null });

  useEffect(() => {
    const node = root.current;
    const panel = numbersPanel.current;
    if (!node || !panel) return;
    const sync = () => {
      if (view === 'numbers' && node.dataset.in) panel.dataset.in = 'true';
      else delete panel.dataset.in;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, { attributes: true, attributeFilter: ['data-in'] });
    return () => observer.disconnect();
  }, [view]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: View = event.key === 'ArrowLeft' || event.key === 'Home' ? 'design' : 'numbers';
    setView(next);
    tabs.current[next]?.focus();
  };

  const tab = (id: View, text: string) => (
    <button
      ref={(node) => {
        tabs.current[id] = node;
      }}
      type='button'
      role='tab'
      id={`evo-tab-${id}`}
      className='evo__tab'
      aria-selected={view === id}
      aria-controls={`evo-panel-${id}`}
      tabIndex={view === id ? 0 : -1}
      onClick={() => setView(id)}
      onKeyDown={onKeyDown}
    >
      {text}
    </button>
  );

  return (
    <div ref={root} className='evo'>
      <div className='evo__tabs' role='tablist' aria-label={labels.group}>
        {tab('design', labels.design)}
        {tab('numbers', labels.numbers)}
      </div>
      <div
        role='tabpanel'
        id='evo-panel-design'
        className='evo__panel'
        aria-labelledby='evo-tab-design'
        hidden={view !== 'design'}
      >
        {design}
      </div>
      <div
        ref={numbersPanel}
        role='tabpanel'
        id='evo-panel-numbers'
        className='evo__panel evo__panel--numbers'
        aria-labelledby='evo-tab-numbers'
        hidden={view !== 'numbers'}
      >
        {numbers}
      </div>
    </div>
  );
}
