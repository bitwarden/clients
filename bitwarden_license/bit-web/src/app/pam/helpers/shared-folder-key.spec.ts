import { readFileSync } from "fs";
import { join } from "path";

import { SHARED_FOLDER_KEY_PAIRS, sharedFolderKey } from "./shared-folder-key";

type Messages = Record<string, { message: string; placeholders?: Record<string, unknown> }>;

const messages: Messages = JSON.parse(
  readFileSync(join(__dirname, "../../../../../../apps/web/src/locales/en/messages.json"), "utf8"),
);

describe("sharedFolderKey", () => {
  it("returns the legacy key while VFO1 terminology is off", () => {
    expect(sharedFolderKey("pamAccessRuleCopyCreated", false)).toBe("pamAccessRuleCopyCreated");
  });

  it("returns the shared folder variant while VFO1 terminology is on", () => {
    expect(sharedFolderKey("pamAccessRuleCopyCreated", true)).toBe(
      "pamAccessRuleCopyCreatedSharedFolder",
    );
  });

  it("passes through keys that have no variant", () => {
    expect(sharedFolderKey("pamAccessRuleNameRequired", true)).toBe("pamAccessRuleNameRequired");
  });

  it.each(SHARED_FOLDER_KEY_PAIRS)("%s and %s both exist with the same placeholders", (a, b) => {
    expect(messages[a]).toBeDefined();
    expect(messages[b]).toBeDefined();
    expect(Object.keys(messages[b].placeholders ?? {})).toEqual(
      Object.keys(messages[a].placeholders ?? {}),
    );
    // Placeholder tokens such as $COLLECTIONS$ keep their name; only the visible wording changes.
    expect(messages[b].message.replace(/\$[A-Z_]+\$/g, "")).not.toMatch(/collection/i);
  });
});
