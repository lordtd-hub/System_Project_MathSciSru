import { existsSync } from "node:fs";
import { join } from "node:path";

export function ManualScreenshot({
  root,
  file,
  alt
}: {
  root: string;
  file: string;
  alt: string;
}) {
  const publicPath = `${root}/${file}`;
  const localPath = join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  const hasImage = existsSync(localPath);

  return (
    <figure className="mt-4 overflow-hidden rounded-lg border border-line bg-paperSoft">
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={publicPath} alt={alt} className="h-auto w-full object-contain" />
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="rounded-full border border-brand/20 bg-red-50 px-3 py-1 text-xs font-semibold text-brand">
            รอภาพจาก QA จริง
          </div>
          <div className="max-w-xl text-sm leading-6 text-muted">
            ถ่ายภาพหลังเข้าสู่ระบบแล้วเท่านั้น จากนั้นบันทึกเป็น{" "}
            <code className="rounded bg-white px-1.5 py-0.5 text-xs text-ink">{publicPath}</code>
          </div>
        </div>
      )}
      <figcaption className="border-t border-line bg-surface px-4 py-3 text-xs leading-5 text-muted">
        {alt}
      </figcaption>
    </figure>
  );
}
