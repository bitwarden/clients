import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { healthNavButton$ } from "./health-nav-button";
import { HealthAccessService } from "./services/health-access.service";

describe("healthNavButton$", () => {
  const userId = Utils.newGuid() as UserId;

  let accountService: AccountService;
  let healthAccessService: MockProxy<HealthAccessService>;
  let healthEnabled$: BehaviorSubject<boolean>;
  let hasBeenOpened$: BehaviorSubject<boolean>;

  beforeEach(() => {
    healthEnabled$ = new BehaviorSubject<boolean>(true);
    hasBeenOpened$ = new BehaviorSubject<boolean>(false);

    accountService = mockAccountServiceWith(userId);

    healthAccessService = mock<HealthAccessService>();
    healthAccessService.healthEnabled$.mockReturnValue(healthEnabled$);
    healthAccessService.healthHasBeenOpened$.mockReturnValue(hasBeenOpened$);
  });

  it("builds the Health tab when the User has access", async () => {
    const button = await firstValueFrom(healthNavButton$(accountService, healthAccessService));

    expect(button).toEqual(expect.objectContaining({ label: "health", page: "/tabs/health" }));
  });

  it("shows a berry until the User has opened the Health report", async () => {
    const button = await firstValueFrom(healthNavButton$(accountService, healthAccessService));

    expect(button?.showBerry).toBe(true);
  });

  it("hides the berry once the User has opened the Health report", async () => {
    hasBeenOpened$.next(true);

    const button = await firstValueFrom(healthNavButton$(accountService, healthAccessService));

    expect(button?.showBerry).toBe(false);
  });

  it("builds no tab when the User does not have access", async () => {
    healthEnabled$.next(false);

    const button = await firstValueFrom(healthNavButton$(accountService, healthAccessService));

    expect(button).toBeUndefined();
  });
});
