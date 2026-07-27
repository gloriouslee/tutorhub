import { access } from "node:fs/promises";
import path from "node:path";

const pauseFile = path.join(process.cwd(), ".production-deploy-paused");

async function main() {
  try {
    await access(pauseFile);
    console.error(
      "Production deploy is paused by .production-deploy-paused. Follow the production runbook before removing the gate.",
    );
    process.exitCode = 1;
  } catch {
    if (process.env.PRODUCTION_DEPLOY_APPROVED !== "true") {
      console.error("PRODUCTION_DEPLOY_APPROVED=true is required for production deploy.");
      process.exitCode = 1;
    } else {
      console.log("Production deployment gate passed.");
    }
  }
}

void main();
