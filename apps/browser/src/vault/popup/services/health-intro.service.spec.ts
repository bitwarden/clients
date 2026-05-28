import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { HealthIntroService } from "./health-intro.service";

describe("HealthIntroService", () => {
  let stateProvider: FakeStateProvider;
  let service: HealthIntroService;

  beforeEach(() => {
    const accountService = mockAccountServiceWith(Utils.newGuid() as UserId);
    stateProvider = new FakeStateProvider(accountService);
    service = new HealthIntroService(stateProvider);
  });

  it("emits false when no state has been written", async () => {
    expect(await firstValueFrom(service.healthIntroDismissed$)).toBe(false);
  });

  it("emits true after setHealthIntroDismissed is called", async () => {
    await service.setHealthIntroDismissed();

    expect(await firstValueFrom(service.healthIntroDismissed$)).toBe(true);
  });

  it("is idempotent — calling setHealthIntroDismissed twice still resolves to true", async () => {
    await service.setHealthIntroDismissed();
    await service.setHealthIntroDismissed();

    expect(await firstValueFrom(service.healthIntroDismissed$)).toBe(true);
  });

  it("healthBerryDismissed$ emits false when no state has been written", async () => {
    expect(await firstValueFrom(service.healthBerryDismissed$)).toBe(false);
  });

  it("healthBerryDismissed$ emits true after setHealthBerryDismissed is called", async () => {
    await service.setHealthBerryDismissed();

    expect(await firstValueFrom(service.healthBerryDismissed$)).toBe(true);
  });

  it("berry and intro dismissals are independent", async () => {
    await service.setHealthBerryDismissed();

    expect(await firstValueFrom(service.healthBerryDismissed$)).toBe(true);
    expect(await firstValueFrom(service.healthIntroDismissed$)).toBe(false);
  });
});
