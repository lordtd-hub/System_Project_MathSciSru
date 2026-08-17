import { describe, expect, it } from "vitest";
import { submitButtonInteractionState } from "./SubmitButton";

describe("submit button interaction state", () => {
  it("disables the button while a server action is pending", () => {
    expect(submitButtonInteractionState(true, false)).toEqual({ disabled: true, state: "pending" });
  });

  it("keeps an enabled button interactive when no action is pending", () => {
    expect(submitButtonInteractionState(false, false)).toEqual({ disabled: false, state: "idle" });
  });

  it("preserves an explicit disabled state", () => {
    expect(submitButtonInteractionState(false, true)).toEqual({ disabled: true, state: "idle" });
  });
});
