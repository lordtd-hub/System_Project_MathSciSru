export function SimpleTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-line bg-white"><table className="w-full text-left text-sm">{children}</table></div>;
}
