import { SectionHeading } from "./SectionHeading";

export function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel space-y-4">
      <SectionHeading title={title} description={description} compact />
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
