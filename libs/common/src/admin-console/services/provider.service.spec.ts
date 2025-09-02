import { firstValueFrom } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { FakeSingleUserState } from "../../../spec/fake-state";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import {
  ProviderStatusType,
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "../enums";
import { ProviderData } from "../models/data/provider.data";
import { Provider } from "../models/domain/provider";

import { PROVIDERS, ProviderService } from "./provider.service";

/**
 * It is easier to read arrays than records in code, but we store a record
 * in state. This helper methods lets us build provider arrays in tests
 * and easily map them to records before storing them in state.
 */
function arrayToRecord(input: ProviderData[]): Record<string, ProviderData> {
  if (input == null) {
    return undefined;
  }
  return Object.fromEntries(input?.map((i) => [i.id, i]));
}

/**
 * Builds a simple mock `ProviderData[]` array that can be used in tests
 * to populate state.
 * @param count The number of organizations to populate the list with. The
 * function returns undefined if this is less than 1. The default value is 1.
 * @param suffix A string to append to data fields on each provider.
 * This defaults to the index of the organization in the list.
 * @returns a `ProviderData[]` array that can be used to populate
 * stateProvider.
 */
function buildMockProviders(count = 1, suffix?: string): ProviderData[] {
  if (count < 1) {
    return undefined;
  }

  function buildMockProvider(id: string, name: string): ProviderData {
    const data = new ProviderData({} as any);
    data.id = id;
    data.name = name;

    return data;
  }

  const mockProviders = [];
  for (let i = 0; i < count; i++) {
    const s = suffix ? suffix + i.toString() : i.toString();
    mockProviders.push(buildMockProvider("provider" + s, "provider" + s));
  }

  return mockProviders;
}

describe("PROVIDERS key definition", () => {
  const sut = PROVIDERS;
  it("should deserialize to a proper ProviderData object", async () => {
    const expectedResult: Record<string, ProviderData> = {
      "1": {
        id: "string",
        name: "string",
        status: ProviderUserStatusType.Accepted,
        type: ProviderUserType.ServiceUser,
        enabled: true,
        userId: "string",
        useEvents: true,
        providerStatus: ProviderStatusType.Pending,
        providerType: ProviderType.Msp,
      },
    };
    const result = sut.deserializer(JSON.parse(JSON.stringify(expectedResult)));
    expect(result).toEqual(expectedResult);
  });
});

describe("ProviderService", () => {
  let providerService: ProviderService;

  const fakeUserId = Utils.newGuid() as UserId;
  let fakeAccountService: FakeAccountService;
  let fakeStateProvider: FakeStateProvider;
  let fakeUserState: FakeSingleUserState<Record<string, ProviderData>>;

  beforeEach(async () => {
    fakeAccountService = mockAccountServiceWith(fakeUserId);
    fakeStateProvider = new FakeStateProvider(fakeAccountService);
    fakeUserState = fakeStateProvider.singleUser.getFake(fakeUserId, PROVIDERS);

    providerService = new ProviderService(fakeStateProvider);
  });

  describe("getAll()", () => {
    it("Returns an array of all providers stored in state", async () => {
      const mockData: ProviderData[] = buildMockProviders(5);
      fakeUserState.nextState(arrayToRecord(mockData));
      const providers = await providerService.getAll(fakeUserId);
      expect(providers).toHaveLength(5);
      expect(providers).toEqual(mockData.map((x) => new Provider(x)));
    });

    it("Returns an empty array if no providers are found in state", async () => {
      const mockData: ProviderData[] = undefined;
      fakeUserState.nextState(arrayToRecord(mockData));
      const result = await providerService.getAll(fakeUserId);
      expect(result).toEqual([]);
    });
  });

  describe("get$()", () => {
    it("Returns an observable of a single provider from state that matches the specified id", async () => {
      const mockData = buildMockProviders(5);
      fakeUserState.nextState(arrayToRecord(mockData));
      const result = providerService.get$(mockData[3].id, fakeUserId);
      const provider = await firstValueFrom(result);
      expect(provider).toEqual(new Provider(mockData[3]));
    });

    it("Returns an observable of undefined if the specified provider is not found", async () => {
      const result = providerService.get$("this-provider-does-not-exist", fakeUserId);
      const provider = await firstValueFrom(result);
      expect(provider).toBe(undefined);
    });
  });

  describe("get()", () => {
    it("Returns a single provider from state that matches the specified id", async () => {
      const mockData = buildMockProviders(5);
      fakeUserState.nextState(arrayToRecord(mockData));
      const result = await providerService.get(mockData[3].id, fakeUserId);
      expect(result).toEqual(new Provider(mockData[3]));
    });

    it("Returns undefined if the specified provider id is not found", async () => {
      const result = await providerService.get("this-provider-does-not-exist", fakeUserId);
      expect(result).toBe(undefined);
    });
  });

  describe("save()", () => {
    it("replaces the entire provider list in state for the specified user", async () => {
      const originalData = buildMockProviders(10);
      fakeUserState.nextState(arrayToRecord(originalData));

      const newData = arrayToRecord(buildMockProviders(10, "newData"));
      await providerService.save(newData, fakeUserId);

      expect(fakeUserState.nextMock).toHaveBeenCalledWith(newData);
    });

    // This is more or less a test for logouts
    it("can replace state with null", async () => {
      const originalData = buildMockProviders(2);
      fakeUserState.nextState(arrayToRecord(originalData));
      await providerService.save(null, fakeUserId);

      expect(fakeUserState.nextMock).toHaveBeenCalledWith(null);
    });
  });
});
