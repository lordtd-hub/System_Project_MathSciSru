import { describe, expect, it } from "vitest";
import { missingScoreFieldNames } from "./formCompleteness";

describe("score form completeness", () => {
  it("treats missing and blank rubric values as incomplete", () => {
    const formData = new FormData();
    formData.set("selected_zero", "0");
    formData.set("selected_score", "3");
    formData.set("blank", "");

    expect(missingScoreFieldNames(formData, ["selected_zero", "selected_score", "blank", "missing"])).toEqual([
      "blank",
      "missing"
    ]);
  });

  it("accepts an explicitly selected zero score", () => {
    const formData = new FormData();
    formData.set("criterion", "0");

    expect(missingScoreFieldNames(formData, ["criterion"])).toEqual([]);
  });
});

