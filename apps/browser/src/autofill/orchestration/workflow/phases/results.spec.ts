import { mock } from "jest-mock-extended";

import type { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AUTOFILL_INVALID } from "../../utils";

import { invalid } from "./results";

describe("invalid", () => {
  it("ends the fill as invalid, and warns with the reason", () => {
    const log = mock<LogService>();

    const result = invalid(log, "the tab has no URL");

    expect(result).toBe(AUTOFILL_INVALID);
    expect(log.warning).toHaveBeenCalledWith("Autofill attempt invalid: the tab has no URL.");
  });
});
