import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { StateProvider } from "@bitwarden/state";
import { ALL_ITEMS_SCOPE, VaultScopeType } from "@bitwarden/vault";

import { VaultPopupListTableFiltersService } from "./vault-popup-list-table-filters.service";

const USER_ID = "userId" as UserId;
const OTHER_USER_ID = "otherUserId" as UserId;

const restricted$ = new BehaviorSubject<RestrictedCipherType[]>([]);
const featureFlag$ = new BehaviorSubject<boolean>(false);
const cipherListViews$ = new BehaviorSubject<{ type: CipherType }[]>([]);
const folderViews$ = new BehaviorSubject<FolderView[]>([]);
let accountService: FakeAccountService;
let stateProvider: FakeStateProvider;

function setUpService(): VaultPopupListTableFiltersService {
  restricted$.next([]);
  featureFlag$.next(false);
  cipherListViews$.next([]);
  folderViews$.next([]);
  accountService = mockAccountServiceWith(USER_ID);
  stateProvider = new FakeStateProvider(accountService);

  TestBed.configureTestingModule({
    providers: [
      VaultPopupListTableFiltersService,
      {
        provide: AccountService,
        useValue: accountService,
      },
      {
        provide: StateProvider,
        useValue: stateProvider,
      },
      {
        provide: CipherService,
        useValue: { cipherListViews$: () => cipherListViews$ },
      },
      {
        provide: RestrictedItemTypesService,
        useValue: { restricted$, isCipherRestricted: jest.fn().mockReturnValue(false) },
      },
      {
        provide: ConfigService,
        useValue: { getFeatureFlag$: jest.fn(() => featureFlag$) },
      },
      {
        provide: I18nService,
        useValue: { t: (key: string) => key },
      },
      {
        provide: FolderService,
        useValue: { folderViews$: () => folderViews$ },
      },
      {
        provide: OrganizationService,
        useValue: {
          memberOrganizations$: () => new BehaviorSubject([]),
          organizations$: new BehaviorSubject([]),
        },
      },
      {
        provide: CollectionService,
        useValue: {
          decryptedCollections$: () => new BehaviorSubject([]),
          getAllNested: jest.fn(() => [] as TreeNode<CollectionView>[][]),
        },
      },
      {
        provide: PolicyService,
        useValue: { policyAppliesToUser$: jest.fn(() => new BehaviorSubject(false)) },
      },
      {
        provide: AvatarService,
        useValue: { getUserAvatarColor$: () => new BehaviorSubject(undefined) },
      },
      {
        provide: ViewCacheService,
        useValue: {
          signal: jest.fn(() => {
            const s = signal({});
            s.set = (v: object) => s.update(() => v);
            return s;
          }),
        },
      },
    ],
  });

  return TestBed.inject(VaultPopupListTableFiltersService);
}

describe("VaultPopupListTableFiltersService — cipherTypes$", () => {
  let service: VaultPopupListTableFiltersService;

  beforeEach(() => {
    service = setUpService();
  });

  it("returns only cipher types present in the vault", async () => {
    cipherListViews$.next([{ type: CipherType.Login }, { type: CipherType.SecureNote }] as {
      type: CipherType;
    }[]);

    const types = await firstValueFrom(service.cipherTypes$);
    expect(types.map((t) => t.value)).toEqual([CipherType.Login, CipherType.SecureNote]);
  });

  it("returns all unrestricted cipher types present in the vault", async () => {
    cipherListViews$.next([
      { type: CipherType.Login },
      { type: CipherType.Card },
      { type: CipherType.Identity },
      { type: CipherType.SecureNote },
      { type: CipherType.SshKey },
    ] as { type: CipherType }[]);

    const types = await firstValueFrom(service.cipherTypes$);
    expect(types.map((t) => t.value)).toEqual([
      CipherType.Login,
      CipherType.Card,
      CipherType.Identity,
      CipherType.SecureNote,
      CipherType.SshKey,
    ]);
  });

  it("excludes restricted cipher types even when present in the vault", async () => {
    cipherListViews$.next([{ type: CipherType.Login }, { type: CipherType.Card }] as {
      type: CipherType;
    }[]);
    restricted$.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);

    const types = await firstValueFrom(service.cipherTypes$);
    expect(types.map((t) => t.value)).toEqual([CipherType.Login]);
  });

  it("excludes cipher types not in the vault even when unrestricted", async () => {
    cipherListViews$.next([{ type: CipherType.Login }] as { type: CipherType }[]);

    const types = await firstValueFrom(service.cipherTypes$);
    expect(types.map((t) => t.value)).not.toContain(CipherType.Card);
    expect(types.map((t) => t.value)).not.toContain(CipherType.Identity);
    expect(types.map((t) => t.value)).not.toContain(CipherType.SshKey);
  });

  it("excludes BankAccount type when PM32009NewItemTypes flag is disabled", async () => {
    cipherListViews$.next([{ type: CipherType.BankAccount }] as { type: CipherType }[]);
    featureFlag$.next(false);

    const types = await firstValueFrom(service.cipherTypes$);
    expect(types.map((t) => t.value)).not.toContain(CipherType.BankAccount);
  });

  it("includes BankAccount type when PM32009NewItemTypes flag is enabled and items are present", async () => {
    featureFlag$.next(true);
    cipherListViews$.next([{ type: CipherType.BankAccount }] as { type: CipherType }[]);

    const types = await firstValueFrom(service.cipherTypes$);
    expect(types.map((t) => t.value)).toContain(CipherType.BankAccount);
  });
});

describe("VaultPopupListTableFiltersService — per-vault filters", () => {
  const ORG_A = "6b0a3a9c-0b5e-4d8d-9a43-1f0c5e0e7a11" as OrganizationId;
  const ORG_B = "0f6f1a2e-7c3d-4b9a-8e21-5d4c3b2a1f00" as OrganizationId;
  const orgA = { type: VaultScopeType.Organization, organizationId: ORG_A } as const;
  const orgB = { type: VaultScopeType.Organization, organizationId: ORG_B } as const;
  const myVault = { type: VaultScopeType.MyVault } as const;

  let service: VaultPopupListTableFiltersService;

  /** Saves land in state asynchronously, so let them settle before reading back. */
  const save = async (values: Parameters<VaultPopupListTableFiltersService["saveFilters"]>[0]) => {
    service.saveFilters(values);
    await new Promise((resolve) => setTimeout(resolve));
  };

  beforeEach(() => {
    service = setUpService();
  });

  it("starts each vault with an empty selection", async () => {
    service.setScope(orgA);
    await save({ cipherType: CipherType.Card, folder: ["folder-1"] });

    service.setScope(orgB);

    expect(service.cachedFilters()).toEqual({});
    expect(service.hasFilterApplied()).toBe(false);
  });

  it("restores a vault's own selection, including its type, on switching back", async () => {
    service.setScope(orgA);
    await save({ cipherType: CipherType.Card, folder: ["folder-1"] });
    service.setScope(orgB);
    await save({ cipherType: CipherType.Login });

    service.setScope(orgA);

    expect(service.cachedFilters()).toEqual({
      organizationIds: [],
      collectionIds: [],
      folderIds: ["folder-1"],
      cipherType: CipherType.Card,
    });
    expect(service.hasFilterApplied()).toBe(true);
  });

  it("keys All items, My vault, and an organization apart", async () => {
    service.setScope(ALL_ITEMS_SCOPE);
    await save({ cipherType: CipherType.Login });
    service.setScope(myVault);
    await save({ cipherType: CipherType.Card });
    service.setScope(orgA);
    await save({ cipherType: CipherType.Identity });

    service.setScope(ALL_ITEMS_SCOPE);
    expect(service.cachedFilters().cipherType).toBe(CipherType.Login);
    service.setScope(myVault);
    expect(service.cachedFilters().cipherType).toBe(CipherType.Card);
    service.setScope(orgA);
    expect(service.cachedFilters().cipherType).toBe(CipherType.Identity);
  });

  it("keys a null scope as All items", async () => {
    service.setScope(ALL_ITEMS_SCOPE);
    await save({ cipherType: CipherType.Login });
    service.setScope(orgA);

    service.setScope(null);

    expect(service.cachedFilters().cipherType).toBe(CipherType.Login);
  });

  it("restores the vault in view's selection, dropping folders that no longer exist", async () => {
    folderViews$.next([{ id: "folder-1" } as FolderView]);
    service.setScope(orgA);
    await save({ cipherType: CipherType.Card, folder: ["folder-1", "deleted-folder"] });
    service.setScope(orgB);
    await save({ cipherType: CipherType.Login });

    service.setScope(orgA);
    const restored = await firstValueFrom(service.restoreFilters$());

    expect(restored).toEqual({ cipherType: CipherType.Card, folder: ["folder-1"] });
  });

  it("restores each user's own selections when the active account changes", async () => {
    service.setScope(orgA);
    await save({ cipherType: CipherType.Card });

    await accountService.switchAccount(OTHER_USER_ID);
    await new Promise((resolve) => setTimeout(resolve));
    expect(service.cachedFilters()).toEqual({});
    await save({ cipherType: CipherType.Login });

    await accountService.switchAccount(USER_ID);
    await new Promise((resolve) => setTimeout(resolve));
    expect(service.cachedFilters().cipherType).toBe(CipherType.Card);
    await accountService.switchAccount(OTHER_USER_ID);
    await new Promise((resolve) => setTimeout(resolve));
    expect(service.cachedFilters().cipherType).toBe(CipherType.Login);
  });

  it("doesn't read user state when no account is active", async () => {
    const getUser = jest.spyOn(stateProvider, "getUser");

    accountService.activeAccountSubject.next(null);
    await new Promise((resolve) => setTimeout(resolve));

    expect(getUser).not.toHaveBeenCalledWith(undefined, expect.anything());
    expect(getUser).not.toHaveBeenCalledWith(null, expect.anything());
    expect(service.cachedFilters()).toEqual({});
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it("starts a vault with no search text of its own", async () => {
    service.setScope(orgA);
    await service.setSearchText("github");

    service.setScope(orgB);

    expect(service.searchText()).toBe("");
  });

  it("restores a vault's own search text when switching back", async () => {
    service.setScope(orgA);
    await service.setSearchText("github");
    service.setScope(myVault);
    await service.setSearchText("bank");

    service.setScope(orgA);

    expect(service.searchText()).toBe("github");
  });

  it("shows a search as typed before it has been stored", async () => {
    const stored = service.setSearchText("git");

    expect(service.searchText()).toBe("git");
    await stored;
    expect(service.searchText()).toBe("git");
  });

  it("restores each user's own search text and selected vault when the active account changes", async () => {
    await service.setSearchText("github");
    await service.setCachedVaultScopeId(ORG_A);

    await accountService.switchAccount(OTHER_USER_ID);
    await settle();
    expect(service.searchText()).toBe("");
    expect(service.cachedVaultScopeId()).toBeNull();
    await service.setSearchText("bank");
    await service.setCachedVaultScopeId(ORG_B);

    await accountService.switchAccount(USER_ID);
    await settle();
    expect(service.searchText()).toBe("github");
    expect(service.cachedVaultScopeId()).toBe(ORG_A);
    expect(await service.storedVaultScopeId()).toBe(ORG_A);
  });

  it("stores All items as a selected vault of null", async () => {
    await service.setCachedVaultScopeId(ORG_A);

    await service.setCachedVaultScopeId(null);
    await settle();

    expect(service.cachedVaultScopeId()).toBeNull();
    expect(await service.storedVaultScopeId()).toBeNull();
  });
});
