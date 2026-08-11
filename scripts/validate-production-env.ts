import { validateProductionEnv } from "../src/lib/config/env";

const result = validateProductionEnv({
  ...process.env,
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  NEXT_PHASE: undefined
});

if (result.errors.length) {
  console.error("Production environment validation failed:");
  for (const error of result.errors) console.error(`- ${error}`);
}

if (result.warnings.length) {
  console.warn("Production environment warnings:");
  for (const warning of result.warnings) console.warn(`- ${warning}`);
}

if (!result.ok) process.exit(1);

console.log("Production environment validation passed.");
