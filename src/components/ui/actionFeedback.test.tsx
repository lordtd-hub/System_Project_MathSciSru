import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionFeedback } from "./ActionFeedback";

describe("ActionFeedback", () => {
  it("renders Thai success messages for important actions", () => {
    const html = renderToStaticMarkup(<ActionFeedback success="final_decision_saved" />);
    expect(html).toContain("บันทึกผลเรียบร้อยแล้ว");
  });

  it("renders Thai error guidance", () => {
    const html = renderToStaticMarkup(<ActionFeedback error="action_failed" />);
    expect(html).toContain("ไม่สามารถทำรายการได้ กรุณาลองใหม่อีกครั้ง");
  });
});
