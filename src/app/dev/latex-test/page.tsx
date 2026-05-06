import { MarkdownLatexEditor } from "@/components/ui/MarkdownLatexEditor";
import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";

const sample = `โครงงานนี้ศึกษาลำดับเวียนเกิดในรูปแบบ $x_{n+1}=f(x_n)$

และต้องการพิสูจน์ว่า

$$
\\lim_{n\\to\\infty} x_n = L
$$

ทดสอบความปลอดภัย:

<script>alert("xss")</script>`;

export default function DevLatexTestPage() {
  return (
    <div className="space-y-6">
      <section className="panel">
        <h1 className="text-2xl font-semibold">ทดสอบ Markdown และ LaTeX</h1>
        <p className="mt-2 text-sm text-muted">
          หน้านี้ใช้ตรวจเร็วใน development เท่านั้น หน้าจริงของ student/teacher/admin ใช้ component เดียวกัน
        </p>
      </section>

      <section className="panel">
        <MarkdownLatexEditor
          name="latex_test"
          label="ทดลองพิมพ์ Markdown + LaTeX"
          defaultValue={sample}
          rows={10}
          required={false}
        />
      </section>

      <section className="panel">
        <h2 className="mb-3 text-lg font-semibold">ตัวอย่าง read-only display</h2>
        <MarkdownLatexViewer value={sample} />
      </section>
    </div>
  );
}
