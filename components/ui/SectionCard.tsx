interface SectionCardProps {
  title: string;
  description?: string;
}

export default function SectionCard({ title, description }: SectionCardProps) {
  return (
    <article className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {description ? <p>{description}</p> : null}
    </article>
  );
}
