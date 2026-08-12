"use client";

import Link from "next/link";
import { useEffect } from "react";

export function RoleErrorBoundary({
  error,
  reset,
  dashboardHref
}: {
  error: Error & { digest?: string };
  reset: () => void;
  dashboardHref: string;
}) {
  useEffect(() => {
    console.error(JSON.stringify({
      type: "route_error_boundary",
      digest: error.digest ?? "unavailable"
    }));
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <section className="panel">
        <h1 className="text-xl font-semibold">โหลดหน้านี้ไม่สำเร็จ</h1>
        <p className="mt-2 text-sm text-muted">
          ข้อมูลที่กรอกในหน้าอาจยังอยู่ในเบราว์เซอร์ กรุณาลองอีกครั้งก่อนกลับหน้าแดชบอร์ด
        </p>
        {error.digest ? <p className="mt-2 text-xs text-muted">รหัสตรวจสอบ: {error.digest}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="button" onClick={reset}>ลองอีกครั้ง</button>
          <Link className="button-secondary" href={dashboardHref}>กลับหน้าแดชบอร์ด</Link>
        </div>
      </section>
    </main>
  );
}
