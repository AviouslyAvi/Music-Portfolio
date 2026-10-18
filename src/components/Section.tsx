export function Section({
  title,
  label,
  tone,
  children,
}: {
  title?: string;
  label?: string;
  tone?: 'warm';
  children: React.ReactNode;
}) {
  return (
    <section className={`section${tone === 'warm' ? ' section-warm' : ''}`}>
      <div className="container">
        {label && <p className="eyebrow">{label}</p>}
        {title && <h2 className="section-title">{title}</h2>}
        {children}
      </div>
    </section>
  );
}
