import { SectionHeading } from "./SectionHeading";

export function SectionCard({
  title,
  description,
  children,
  actions
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="section-card">
      {title || description || actions ? (
        <SectionHeading title={title ?? ""} description={description} actions={actions} compact />
      ) : null}
      {children}
    </section>
  );
}
