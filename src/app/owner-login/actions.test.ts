import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ headers: vi.fn(), auth: vi.fn(), signIn: vi.fn(), enroll: vi.fn(), change: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mock.headers }));
vi.mock("@/auth", () => ({ auth: mock.auth, signIn: mock.signIn }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/auth/ownerPassword", () => ({ getOwnerPasswordUserId: () => "synthetic-owner", enrollOwnerPassword: mock.enroll, changeOwnerPassword: mock.change }));
import { ownerPasswordChange, ownerPasswordLogin, ownerPasswordSetup } from "./actions";
import { isOwnerPasswordOriginAllowed } from "@/lib/auth/ownerPasswordOrigin";

function form() {
  const data = new FormData();
  data.set("email", "synthetic@example.test");
  data.set("code", "A".repeat(43));
  data.set("password", "synthetic long replacement password");
  data.set("confirm", "synthetic long replacement password");
  data.set("currentPassword", "synthetic original owner password");
  data.set("userId", "attacker-selected-user-id");
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_URL", "https://app.example.test");
  mock.headers.mockResolvedValue(new Headers({ origin: "https://app.example.test" }));
  mock.auth.mockResolvedValue({ user: { id: "synthetic-owner", role: "ADMIN" } });
  mock.enroll.mockResolvedValue(true);
  mock.change.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("owner credential CSRF and target guards", () => {
  it.each([null, "https://evil.example.test", "https://app.example.test.evil.test", "null"])("rejects untrusted Origin %s", async (origin) => {
    mock.headers.mockResolvedValue(new Headers(origin ? { origin } : {}));
    expect((await ownerPasswordLogin({ error: "" }, form())).error).not.toBe("");
    expect((await ownerPasswordSetup({ error: "" }, form())).error).not.toBe("");
    expect((await ownerPasswordChange({ error: "" }, form())).error).not.toBe("");
    expect(mock.signIn).not.toHaveBeenCalled();
    expect(mock.enroll).not.toHaveBeenCalled();
    expect(mock.change).not.toHaveBeenCalled();
  });
  it("compares to configured trusted origin, rejecting insecure remote/credential-bearing URLs", () => {
    expect(isOwnerPasswordOriginAllowed("https://app.example.test", "https://user:secret@app.example.test")).toBe(false);
    expect(isOwnerPasswordOriginAllowed("http://app.example.test", "http://app.example.test")).toBe(false);
    expect(isOwnerPasswordOriginAllowed("http://localhost:3000", "http://localhost:3000")).toBe(true);
  });
  it("derives password-change target from authenticated session, ignoring submitted user ID", async () => {
    await expect(ownerPasswordChange({ error: "" }, form())).rejects.toThrow("REDIRECT:/owner-login?changed=complete");
    expect(mock.change).toHaveBeenCalledWith("synthetic-owner", "synthetic original owner password", "synthetic long replacement password");
  });
  it.each([null, { user: { id: "other-user", role: "ADMIN" } }, { user: { id: "synthetic-owner", role: "STUDENT" } }])("rejects unauthenticated/wrong-ID/nonadmin changes", async (session) => {
    mock.auth.mockResolvedValue(session);
    expect((await ownerPasswordChange({ error: "" }, form())).error).not.toBe("");
    expect(mock.change).not.toHaveBeenCalled();
  });
  it("setup never signs the user in and uses a secret-free fixed redirect", async () => {
    await expect(ownerPasswordSetup({ error: "" }, form())).rejects.toThrow("REDIRECT:/owner-login?setup=complete");
    expect(mock.signIn).not.toHaveBeenCalled();
  });
  it("does not echo passwords or setup codes when the storage operation fails", async () => {
    mock.enroll.mockRejectedValue(new Error("synthetic secret-bearing error must not escape"));
    const result = await ownerPasswordSetup({ error: "" }, form());
    expect(JSON.stringify(result)).not.toContain("secret-bearing");
    expect(JSON.stringify(result)).not.toContain("A".repeat(43));
  });
  it("requires matching new-password confirmation", async () => {
    const input = form(); input.set("confirm", "mismatch");
    expect((await ownerPasswordSetup({ error: "" }, input)).error).not.toBe("");
    expect(mock.enroll).not.toHaveBeenCalled();
  });
});
