import { readFileSync } from "fs";
import { join } from "path";

import { buildChromiumManagedSchema } from "@bitwarden/common/platform/managed-settings";

describe("managed_schema.json", () => {
  it("matches the catalog-generated schema (run `npm run managed:schema` if this fails)", () => {
    const committedPath = join(__dirname, "..", "..", "managed_schema.json");
    const committed: unknown = JSON.parse(readFileSync(committedPath, "utf8"));

    expect(committed).toEqual(buildChromiumManagedSchema());
  });
});
