import { MarkdownLatexViewer } from "@/components/ui/MarkdownLatexViewer";

export function MarkdownPreview({ value }: { value: string }) {
  return <MarkdownLatexViewer value={value} emptyText="ยังไม่มีข้อความสำหรับ preview" />;
}
