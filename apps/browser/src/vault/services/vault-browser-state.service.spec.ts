import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { Jsonify } from "type-fest";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";

import { BrowserComponentState } from "../../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../../models/browserGroupingsComponentState";

import {
  VAULT_BROWSER_COMPONENT,
  VAULT_BROWSER_GROUPINGS_COMPONENT,
  VaultBrowserStateService,
} from "./vault-browser-state.service";

describe("Vault Browser State Service", () => {
  let stateProvider: FakeStateProvider;

  let accountService: FakeAccountService;
  let stateService: VaultBrowserStateService;
  const mockUserId = Utils.newGuid() as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    stateService = new VaultBrowserStateService(stateProvider);
  });

  describe("getBrowserGroupingsComponentState", () => {
    it("should return a BrowserGroupingsComponentState", async () => {
      await stateService.setBrowserGroupingsComponentState(new BrowserGroupingsComponentState());

      const actual = await stateService.getBrowserGroupingsComponentState();

      expect(actual).toBeInstanceOf(BrowserGroupingsComponentState);
    });

    it("should deserialize BrowserGroupingsComponentState", () => {
      const sut = VAULT_BROWSER_GROUPINGS_COMPONENT;

      const expectedState = {
        deletedCount: 0,
        collectionCounts: new Map<string, number>(),
        folderCounts: new Map<string, number>(),
        typeCounts: new Map<CipherType, number>(),
      };

      const result = sut.deserializer(
        JSON.parse(JSON.stringify(expectedState)) as Jsonify<BrowserGroupingsComponentState>,
      );

      expect(result).toEqual(expectedState);
    });
  });

  describe("getBrowserVaultItemsComponentState", () => {
    it("should deserialize BrowserComponentState", () => {
      const sut = VAULT_BROWSER_COMPONENT;

      const expectedState = {
        scrollY: 0,
        searchText: "test",
      };

      const result = sut.deserializer(JSON.parse(JSON.stringify(expectedState)));

      expect(result).toEqual(expectedState);
    });

    it("should return a BrowserComponentState", async () => {
      const componentState = new BrowserComponentState();
      componentState.scrollY = 0;
      componentState.searchText = "test";

      await stateService.setBrowserVaultItemsComponentState(componentState);

      const actual = await stateService.getBrowserVaultItemsComponentState();
      expect(actual).toStrictEqual(componentState);
    });
  });
});
