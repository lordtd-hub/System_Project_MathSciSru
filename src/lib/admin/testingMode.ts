type EnvLike = Record<string, string | undefined>;

export function isAdminTestingToolsEnabled(env: EnvLike = process.env) {
  return env.ENABLE_ADMIN_TEST_TOOLS === "1";
}
