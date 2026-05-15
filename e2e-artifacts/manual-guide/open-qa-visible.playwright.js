const { chromium } = require("playwright");

const QA_URL =
  process.env.QA_PREVIEW_URL ||
  "https://system-project-math-sci-8nu3416ka-lordtd-hubs-projects.vercel.app";

async function main() {
  const context = await chromium.launchPersistentContext(".edgepilot-visible-profile", {
    channel: "msedge",
    headless: false,
    viewport: { width: 1440, height: 950 },
    args: ["--start-maximized"],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(`${QA_URL}/qa-login`, { waitUntil: "domcontentloaded" });
  await page.bringToFront();

  const title = await page.title().catch(() => "");
  const url = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const blocked =
    /vercel|login/i.test(url) ||
    /Vercel|Continue with|Log in|Deployment Protection/i.test(bodyText);

  console.log(JSON.stringify({ url, title, blocked }, null, 2));
  console.log("Visible QA browser is open. Do not close it. Press Ctrl+C here only when done.");

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
