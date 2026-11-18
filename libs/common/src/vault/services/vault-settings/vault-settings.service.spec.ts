import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { mockAccountServiceWith } from "../../../../spec/fake-account-service";
import { FakeStateProvider } from "../../../../spec/fake-state-provider";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { CipherType } from "../../enums";
import { RestrictedItemTypesService } from "../restricted-item-types.service";

import { VaultSettingsService } from "./vault-settings.service";

describe("VaultSettingsService", () => {
  let service: VaultSettingsService;
  let stateProvider: FakeStateProvider;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;

  const mockUserId = Utils.newGuid() as UserId;

  beforeEach(() => {
    const accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    (restrictedItemTypesService as any).restrictedSet$ = of(new Set<CipherType>());

    service = new VaultSettingsService(stateProvider, restrictedItemTypesService);
  });

  describe("showAtRiskPasswordNotifications$", () => {
    it("defaults to true when no value is stored", async () => {
      const result = await firstValueFrom(service.showAtRiskPasswordNotifications$);
      expect(result).toBe(true);
    });

    it("emits false after setShowAtRiskPasswordNotifications(false)", async () => {
      await service.setShowAtRiskPasswordNotifications(false);
      const result = await firstValueFrom(service.showAtRiskPasswordNotifications$);
      expect(result).toBe(false);
    });

    it("emits true after setShowAtRiskPasswordNotifications(true)", async () => {
      await service.setShowAtRiskPasswordNotifications(false);
      await service.setShowAtRiskPasswordNotifications(true);
      const result = await firstValueFrom(service.showAtRiskPasswordNotifications$);
      expect(result).toBe(true);
    });
  });

  describe("current tab suggestions", () => {
    const restrict = (...types: CipherType[]) => {
      (restrictedItemTypesService as any).restrictedSet$ = of(new Set(types));
      service = new VaultSettingsService(stateProvider, restrictedItemTypesService);
    };

    it("shows cards and identities when nothing is restricted", async () => {
      expect(await firstValueFrom(service.showCardsCurrentTab$)).toBe(true);
      expect(await firstValueFrom(service.showIdentitiesCurrentTab$)).toBe(true);
    });

    it("hides identities only when the identity type is restricted", async () => {
      restrict(CipherType.Identity);
      expect(await firstValueFrom(service.showIdentitiesCurrentTab$)).toBe(false);
      expect(await firstValueFrom(service.showCardsCurrentTab$)).toBe(true);
    });

    it("hides cards only when the card type is restricted", async () => {
      restrict(CipherType.Card);
      expect(await firstValueFrom(service.showCardsCurrentTab$)).toBe(false);
      expect(await firstValueFrom(service.showIdentitiesCurrentTab$)).toBe(true);
    });
  });
});
