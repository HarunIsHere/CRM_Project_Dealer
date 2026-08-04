import fs from "node:fs";

import {
  OUTPUTS,
  generatedAdminOutputs,
  loadAdminCatalog
} from "./generate_admin_i18n.mjs";

const catalog = loadAdminCatalog();
const generated = generatedAdminOutputs(catalog);

for (const [target, outputPath] of Object.entries(OUTPUTS)) {
  if (!fs.existsSync(outputPath)) throw new Error(`admin i18n: missing ${target} output`);
  if (fs.readFileSync(outputPath, "utf8") !== generated[target]) {
    throw new Error(
      `admin i18n: stale ${target} output; run node scripts/generate_admin_i18n.mjs`
    );
  }
}

process.stdout.write(
  `Admin i18n valid: ${Object.keys(catalog.en).length} keys x ${Object.keys(catalog).length} locales.\n`
);
