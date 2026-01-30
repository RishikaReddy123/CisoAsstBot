import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { storePolicy } from "../utils/qdrant.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pdfPath = path.join(__dirname, "../data/acme_policy.pdf");

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found at path: ${pdfPath}`);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text.trim();

  await storePolicy(text);
  console.log("Policy ingestion complete!");
}

main().catch(console.error);
