import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, throwError } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { clientIsGovMode$ } from "./gov-mode";

const USER_ID = "user-id" as UserId;

describe("clientIsGovMode$", () => {
  let accountService: AccountService;
  let govModeService: MockProxy<GovModeService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    accountService = mockAccountServiceWith(USER_ID) as unknown as AccountService;
    govModeService = mock<GovModeService>();
    logService = mock<LogService>();
  });

  it.each([true, false])("emits the active user's Gov mode state (%s)", async (isGovMode) => {
    govModeService.isGovMode$.mockReturnValue(of(isGovMode));

    const result = await firstValueFrom(
      clientIsGovMode$(accountService, govModeService, logService),
    );

    expect(result).toBe(isGovMode);
    expect(govModeService.isGovMode$).toHaveBeenCalledWith(USER_ID);
  });

  it("fails open and emits false when the Gov mode check errors", async () => {
    govModeService.isGovMode$.mockReturnValue(throwError(() => new Error("boom")));

    const result = await firstValueFrom(
      clientIsGovMode$(accountService, govModeService, logService),
    );

    expect(result).toBe(false);
    expect(logService.error).toHaveBeenCalled();
  });

  it("includes the caller context in the fail-open log entry", async () => {
    govModeService.isGovMode$.mockReturnValue(throwError(() => new Error("boom")));

    await firstValueFrom(
      clientIsGovMode$(accountService, govModeService, logService, "some caller"),
    );

    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining("(some caller)"),
      expect.any(Error),
    );
  });

  it.each([true, false])(
    "falls back to the global environment when there is no active account (%s)",
    async (isGovMode) => {
      accountService = { activeAccount$: of(null as Account | null) } as AccountService;
      govModeService.globalIsGovMode$ = of(isGovMode);

      const result = await firstValueFrom(
        clientIsGovMode$(accountService, govModeService, logService),
      );

      expect(result).toBe(isGovMode);
      expect(govModeService.isGovMode$).not.toHaveBeenCalled();
      expect(logService.error).not.toHaveBeenCalled();
    },
  );
});
