import fs from "node:fs";
import {
  OUTPUT_PATH,
  generateIdentityEmailModule,
  loadIdentityEmailCatalog
} from "./generate-identity-i18n.mjs";

const catalog = loadIdentityEmailCatalog();
const expected = generateIdentityEmailModule(catalog);

if (!fs.existsSync(OUTPUT_PATH)) {
  throw new Error(
    "identity email generated module is missing; run node scripts/generate-identity-i18n.mjs"
  );
}

const actual = fs.readFileSync(OUTPUT_PATH, "utf8");
if (actual !== expected) {
  throw new Error(
    "identity email generated module is stale; run node scripts/generate-identity-i18n.mjs"
  );
}

process.stdout.write(
  `Identity email catalog valid: ${Object.keys(catalog.templates).length} templates x `
    + `${catalog.supported_locales.length} locales\n`
);
