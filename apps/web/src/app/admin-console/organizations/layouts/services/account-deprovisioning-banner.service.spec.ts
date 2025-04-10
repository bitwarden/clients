import { firstValueFrom } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { AccountDeprovisioningBannerService } from "./account-deprovisioning-banner.service";

describe("Account Deprovisioning Banner Service", () => {
  const userId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let bannerService: AccountDeprovisioningBannerService;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    bannerService = new AccountDeprovisioningBannerService(stateProvider);
  });

  it("updates state with single org", async () => {
    const fakeOrg = new Organization();
    fakeOrg.id = "123";

    await bannerService.hideBanner(fakeOrg);
    const state = await firstValueFrom(bannerService.showBanner$);

    expect(state).toEqual([fakeOrg.id]);
  });

  it("updates state with multiple orgs", async () => {
    const fakeOrg1 = new Organization();
    fakeOrg1.id = "123";
    const fakeOrg2 = new Organization();
    fakeOrg2.id = "234";
    const fakeOrg3 = new Organization();
    fakeOrg3.id = "987";

    await bannerService.hideBanner(fakeOrg1);
    await bannerService.hideBanner(fakeOrg2);
    await bannerService.hideBanner(fakeOrg3);

    const state = await firstValueFrom(bannerService.showBanner$);

    expect(state).toContain(fakeOrg1.id);
    expect(state).toContain(fakeOrg2.id);
    expect(state).toContain(fakeOrg3.id);
  });

  it("does not add the same org id multiple times", async () => {
    const fakeOrg = new Organization();
    fakeOrg.id = "123";

    await bannerService.hideBanner(fakeOrg);
    await bannerService.hideBanner(fakeOrg);

    const state = await firstValueFrom(bannerService.showBanner$);

    expect(state).toEqual([fakeOrg.id]);
  });

  it("does not add null to the state", async () => {
    await bannerService.hideBanner(null as unknown as Organization);
    await bannerService.hideBanner(undefined as unknown as Organization);

    const state = await firstValueFrom(bannerService.showBanner$);

    expect(state).toBeNull();
  });
});
