type HeroLegendProps = {
  title: string;
  items: { part: string; tech: string }[];
  className?: string;
};

export function HeroLegend({ title, items, className }: HeroLegendProps) {
  return (
    <div className={className ? `legend ${className}` : 'legend'}>
      <p className='legend__title'>{title}</p>
      <ul>
        {items.map((item, index) => (
          <li key={item.part} style={{ '--i': index } as React.CSSProperties}>
            <span className='legend__part'>{item.part}</span>
            <span>{item.tech}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
