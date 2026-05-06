import { PrismaClient } from "@prisma/client";
import { cleanKnownDemoData } from "./demo-data";

const prisma = new PrismaClient();

cleanKnownDemoData(prisma)
  .then(async (result) => {
    console.log(`Cleaned demo/E2E data: ${result.courseOfferingsDeleted} course offerings, ${result.roundsDeleted} rounds, ${result.projectsDeleted} projects.`);
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
