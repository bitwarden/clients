import { MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { UserId } from "../../../types/guid";

import { DefaultOrganizationManagementPreferencesService } from "./default-organization-management-preferences.service";

describe("OrganizationManagementPreferencesService", () => {
  let stateProvider: FakeStateProvider;
  let organizationManagementPreferencesService: MockProxy<DefaultOrganizationManagementPreferencesService>;

  beforeEach(() => {
    const accountService = mockAccountServiceWith("userId" as UserId);
    stateProvider = new FakeStateProvider(accountService);
    organizationManagementPreferencesService = new DefaultOrganizationManagementPreferencesService(
      stateProvider,
    );
  });

  describe("autoConfirmFingerPrints", () => {
    it("returns false by default", async () => {
      const value = await firstValueFrom(
        organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
      );
      expect(value).toEqual(false);
    });
    it("returns true if set", async () => {
      await organizationManagementPreferencesService.autoConfirmFingerPrints.set(true);
      const value = await firstValueFrom(
        organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
      );
      expect(value).toEqual(true);
    });
    it("can be unset", async () => {
      await organizationManagementPreferencesService.autoConfirmFingerPrints.set(true);
      await organizationManagementPreferencesService.autoConfirmFingerPrints.set(false);
      const value = await firstValueFrom(
        organizationManagementPreferencesService.autoConfirmFingerPrints.state$,
      );
      expect(value).toEqual(false);
    });
  });
});
