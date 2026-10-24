// @ts-strict-ignore
import { mock } from "jest-mock-extended";

import { GetCommand } from "./get.command";

describe("GetCommand", () => {
  let command: GetCommand;

  beforeEach(() => {
    // The template objects do not touch any injected service.
    command = new (GetCommand as any)(...new Array(16).fill(null).map(() => mock()));
  });

  describe("template aliases", () => {
    it.each([
      ["collection", "shared-folder"],
      ["item-collections", "item-shared-folders"],
      ["org-collection", "org-shared-folder"],
    ])("returns the same template for %s and %s", async (original, alias) => {
      const expected = await command.run("template", original, {});
      const actual = await command.run("template", alias, {});

      expect(expected.success).toBe(true);
      expect(actual.success).toBe(true);
      expect(actual.data).toEqual(expected.data);
    });
  });
});
