import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { Utils } from "../../../platform/misc/utils";
import { OrganizationId, UserId } from "../../../types/guid";
import { OrganizationData } from "../../models/data/organization.data";
import { Organization } from "../../models/domain/organization";

import { DefaultOrganizationService } from "./default-organization.service";
import { ORGANIZATIONS } from "./organization.state";

describe("OrganizationService", () => {
  let organizationService: DefaultOrganizationService;

  const fakeUserId = Utils.newGuid() as UserId;
  let fakeStateProvider: FakeStateProvider;

  /**
   * It is easier to read arrays than records in code, but we store a record
   * in state. This helper methods lets us build organization arrays in tests
   * and easily map them to records before storing them in state.
   */
  function arrayToRecord(input: OrganizationData[]): Record<OrganizationId, OrganizationData> {
    if (input == null) {
      return undefined;
    }
    return Object.fromEntries(input?.map((i) => [i.id, i]));
  }

  /**
   * There are a few assertions in this spec that check for array equality
   * but want to ignore a specific index that _should_ be different. This
   * function takes two arrays, and an index. It checks for equality of the
   * arrays, but splices out the specified index from both arrays first.
   */
  function expectIsEqualExceptForIndex(x: any[], y: any[], indexToExclude: number) {
    // Clone the arrays to avoid modifying the reference values
    const a = [...x];
    const b = [...y];
    delete a[indexToExclude];
    delete b[indexToExclude];
    expect(a).toEqual(b);
  }

  /**
   * Builds a simple mock `OrganizationData[]` array that can be used in tests
   * to populate state.
   * @param count The number of organizations to populate the list with. The
   * function returns undefined if this is less than 1. The default value is 1.
   * @param suffix A string to append to data fields on each organization.
   * This defaults to the index of the organization in the list.
   * @returns an `OrganizationData[]` array that can be used to populate
   * stateProvider.
   */
  function buildMockOrganizations(count = 1, suffix?: string): OrganizationData[] {
    if (count < 1) {
      return undefined;
    }

    function buildMockOrganization(id: OrganizationId, name: string, identifier: string) {
      const data = new OrganizationData({} as any, {} as any);
      data.id = id;
      data.name = name;
      data.identifier = identifier;

      return data;
    }

    const mockOrganizations = [];
    for (let i = 0; i < count; i++) {
      const s = suffix ? suffix + i.toString() : i.toString();
      mockOrganizations.push(
        buildMockOrganization(("org" + s) as OrganizationId, "org" + s, "orgIdentifier" + s),
      );
    }

    return mockOrganizations;
  }

  const setOrganizationsState = (organizationData: OrganizationData[] | null) =>
    fakeStateProvider.setUserState(
      ORGANIZATIONS,
      organizationData == null ? null : arrayToRecord(organizationData),
      fakeUserId,
    );

  beforeEach(async () => {
    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(fakeUserId));
    organizationService = new DefaultOrganizationService(fakeStateProvider);
  });

  describe("canManageSponsorships", () => {
    it("can because one is available", async () => {
      const mockData: OrganizationData[] = buildMockOrganizations(1);
      mockData[0].familySponsorshipAvailable = true;
      await setOrganizationsState(mockData);
      const result = await firstValueFrom(organizationService.canManageSponsorships$(fakeUserId));
      expect(result).toBe(true);
    });

    it("can because one is used", async () => {
      const mockData: OrganizationData[] = buildMockOrganizations(1);
      mockData[0].familySponsorshipFriendlyName = "Something";
      await setOrganizationsState(mockData);
      const result = await firstValueFrom(organizationService.canManageSponsorships$(fakeUserId));
      expect(result).toBe(true);
    });

    it("can not because one isn't available or taken", async () => {
      const mockData: OrganizationData[] = buildMockOrganizations(1);
      mockData[0].familySponsorshipFriendlyName = null;
      await setOrganizationsState(mockData);
      const result = await firstValueFrom(organizationService.canManageSponsorships$(fakeUserId));
      expect(result).toBe(false);
    });
  });

  describe("organizations$", () => {
    describe("null checking behavior", () => {
      it("publishes an empty array if organizations in state = undefined", async () => {
        const mockData: OrganizationData[] = undefined;
        await setOrganizationsState(mockData);
        const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
        expect(result).toEqual([]);
      });

      it("publishes an empty array if organizations in state = null", async () => {
        const mockData: OrganizationData[] = null;
        await setOrganizationsState(mockData);
        const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
        expect(result).toEqual([]);
      });

      it("publishes an empty array if organizations in state = []", async () => {
        const mockData: OrganizationData[] = [];
        await setOrganizationsState(mockData);
        const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
        expect(result).toEqual([]);
      });

      it("returns state for a user", async () => {
        const mockData = buildMockOrganizations(10);
        await setOrganizationsState(mockData);
        const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
        expect(result).toEqual(mockData);
      });
    });
  });

  describe("upsert()", () => {
    it("can create the organization list if necassary", async () => {
      // Notice that no default state is provided in this test, so the list in
      // `stateProvider` will be null when the `upsert` method is called.
      const mockData = buildMockOrganizations();
      await organizationService.upsert(mockData[0], fakeUserId);
      const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
      expect(result).toEqual(mockData.map((x) => new Organization(x)));
    });

    it("updates an organization that already exists in state", async () => {
      const mockData = buildMockOrganizations(10);
      await setOrganizationsState(mockData);
      const indexToUpdate = 5;
      const anUpdatedOrganization = {
        ...buildMockOrganizations(1, "UPDATED").pop(),
        id: mockData[indexToUpdate].id,
      };
      await organizationService.upsert(anUpdatedOrganization, fakeUserId);
      const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
      expect(result[indexToUpdate]).not.toEqual(new Organization(mockData[indexToUpdate]));
      expect(result[indexToUpdate].id).toEqual(new Organization(mockData[indexToUpdate]).id);
      expectIsEqualExceptForIndex(
        result,
        mockData.map((x) => new Organization(x)),
        indexToUpdate,
      );
    });
  });

  describe("replace()", () => {
    it("replaces the entire organization list in state", async () => {
      const originalData = buildMockOrganizations(10);
      await setOrganizationsState(originalData);

      const newData = buildMockOrganizations(10, "newData");
      await organizationService.replace(arrayToRecord(newData), fakeUserId);

      const result = await firstValueFrom(organizationService.organizations$(fakeUserId));

      expect(result).toEqual(newData);
      expect(result).not.toEqual(originalData);
    });

    // This is more or less a test for logouts
    it("can replace state with null", async () => {
      const originalData = buildMockOrganizations(2);
      await setOrganizationsState(originalData);
      await organizationService.replace(null, fakeUserId);
      const result = await firstValueFrom(organizationService.organizations$(fakeUserId));
      expect(result).toEqual([]);
      expect(result).not.toEqual(originalData);
    });
  });
});
