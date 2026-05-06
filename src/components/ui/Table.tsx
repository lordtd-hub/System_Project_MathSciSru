export function SimpleTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="responsive-scroll border border-line bg-white shadow-sm">
      <table className="responsive-table">{children}</table>
    </div>
  );
}
