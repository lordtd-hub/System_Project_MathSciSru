import { PrismaClient } from "@prisma/client";

const requiredTables = [
  "_prisma_migrations",
  "users",
  "students",
  "teachers",
  "projects",
  "assessment_rounds",
  "assessment_attempts",
  "project_status_history",
  "report_versions",
  "advisor_scores"
];

async function main() {
  const prisma = new PrismaClient();
  const tableList = requiredTables.map((table) => `'${table}'`).join(", ");
  const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (${tableList})
    order by table_name
  `);
  const found = new Set(rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !found.has(table));

  console.log(rows.map((row) => row.table_name).join("\n"));

  if (missing.length) {
    throw new Error(`Missing required tables: ${missing.join(", ")}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
