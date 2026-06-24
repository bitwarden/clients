/* eslint no-console:0 */
import fs from "fs";
import path from "path";

import { buildChromiumManagedSchema } from "../libs/common/src/platform/managed-settings/managed-schema";

const target = path.join(__dirname, "..", "apps", "browser", "src", "managed_schema.json");
const schema = buildChromiumManagedSchema();
fs.writeFileSync(target, JSON.stringify(schema, null, 2) + "\n");
console.log(`Wrote ${target}`);
