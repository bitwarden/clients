import { Command } from "commander";

import { addYesOption, requireYes } from "./destructive";

describe("requireYes", () => {
  it("refuses without --yes and says how to confirm", () => {
    const response = requireYes({}, "end this lease");

    expect(response?.success).toBe(false);
    expect(response?.message).toBe(
      "This would end this lease. Run the command again with --yes to confirm.",
    );
  });

  it("refuses an explicit false", () => {
    expect(requireYes({ yes: false }, "x")?.success).toBe(false);
  });

  it("passes with --yes", () => {
    expect(requireYes({ yes: true }, "x")).toBeUndefined();
  });
});

describe("addYesOption", () => {
  it("adds a flag that never takes a value or prompts", () => {
    const command = addYesOption(new Command("end"));

    const option = command.options.find((o) => o.long === "--yes");
    expect(option).toBeDefined();
    expect(option?.required).toBe(false);
    expect(option?.optional).toBe(false);
  });
});
