import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { clientIsGovMode$ } from "./gov-mode";

const USER_ID = "user-id" as UserId;

describe("clientIsGovMode$", () => {
  let accountService: AccountService;
  let govModeService: MockProxy<GovModeService>;

  beforeEach(() => {
    accountService = mockAccountServiceWith(USER_ID) as unknown as AccountService;
    govModeService = mock<GovModeService>();
  });

  it.each([true, false])("emits the active user's Gov mode state (%s)", async (isGovMode) => {
    govModeService.isGovMode$.mockReturnValue(of(isGovMode));

    const result = await firstValueFrom(clientIsGovMode$(accountService, govModeService));

    expect(result).toBe(isGovMode);
    expect(govModeService.isGovMode$).toHaveBeenCalledWith(USER_ID);
  });

  it.each([true, false])(
    "falls back to the global environment when there is no active account (%s)",
    async (isGovMode) => {
      accountService = { activeAccount$: of(null as Account | null) } as AccountService;
      govModeService.globalIsGovMode$ = of(isGovMode);

      const result = await firstValueFrom(clientIsGovMode$(accountService, govModeService));

      expect(result).toBe(isGovMode);
      expect(govModeService.isGovMode$).not.toHaveBeenCalled();
    },
  );
});
