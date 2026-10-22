import { Provider } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VaultItemsTableRowAction } from "../components/vault-items-table/vault-items-table-row-action";
import { VAULT_ROW_ACTIONS } from "../tokens/vault-row-actions.token";

import { CipherActionService } from "./cipher-action.service";
import { CipherRowMenuService } from "./cipher-row-menu.service";

const userId = "test-user-id" as UserId;

/** Builds a minimal CipherView fixture; all flags default to the permissive/normal case. */
function makeCipher(
  overrides: Partial<{
    edit: boolean;
    favorite: boolean;
    isDeleted: boolean;
    isArchived: boolean;
    hasAttachments: boolean;
    canAssignToCollections: boolean;
    organizationId: string | null;
    collectionIds: string[];
    type: CipherType;
    permissions: { delete: boolean; restore: boolean } | null;
    decryptionFailure: boolean;
    partial: boolean;
    id: string;
  }> = {},
): CipherView {
  return {
    // CipherViewLikeUtils.isCipherListView returns false when typeof type === "number"
    type: CipherType.Login,
    edit: true,
    favorite: false,
    isDeleted: false,
    isArchived: false,
    hasAttachments: false,
    canAssignToCollections: false,
    organizationId: null,
    collectionIds: [],
    ...overrides,
  } as unknown as CipherView;
}

describe("CipherRowMenuService", () => {
  let service: CipherRowMenuService;
  let cipherArchiveService: MockProxy<CipherArchiveService>;
  let organizationService: MockProxy<OrganizationService>;
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;
  let i18nService: MockProxy<I18nService>;
  let userCanArchiveSubject: BehaviorSubject<boolean>;
  let restrictedTypesSubject: BehaviorSubject<RestrictedCipherType[]>;
  let organizationsSubject: BehaviorSubject<Organization[]>;
  let revealedSubject: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;
  let providers: Provider[];

  beforeEach(() => {
    cipherArchiveService = mock<CipherArchiveService>();
    organizationService = mock<OrganizationService>();
    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    userCanArchiveSubject = new BehaviorSubject<boolean>(false);
    restrictedTypesSubject = new BehaviorSubject<RestrictedCipherType[]>([]);

    organizationsSubject = new BehaviorSubject<Organization[]>([]);
    revealedSubject = new BehaviorSubject<ReadonlyMap<CipherId, CipherView>>(new Map());
    const revealedCipherService = mock<RevealedCipherService>();
    revealedCipherService.revealed$.mockReturnValue(revealedSubject.asObservable());
    organizationService.organizations$.mockReturnValue(organizationsSubject.asObservable());

    cipherArchiveService.userCanArchive$.mockReturnValue(userCanArchiveSubject.asObservable());
    Object.defineProperty(restrictedItemTypesService, "restricted$", {
      value: restrictedTypesSubject.asObservable(),
    });

    providers = [
      CipherRowMenuService,
      { provide: CipherArchiveService, useValue: cipherArchiveService },
      { provide: OrganizationService, useValue: organizationService },
      { provide: RestrictedItemTypesService, useValue: restrictedItemTypesService },
      { provide: I18nService, useValue: i18nService },
      { provide: AccountService, useValue: mockAccountServiceWith(userId) },
      { provide: CipherActionService, useValue: mock<CipherActionService>() },
      { provide: RevealedCipherService, useValue: revealedCipherService },
    ];
    TestBed.configureTestingModule({ providers });

    service = TestBed.inject(CipherRowMenuService);
  });

  /** Calls the `show` predicate for the named action. */
  function show(actionId: string, cipher: CipherView, collections: CollectionView[] = []): boolean {
    const action = service
      .getRowActions(collections, {
        edit: () => {},
        clone: () => {},
        assignToCollections: () => {},
      })
      .find((a) => a.id === actionId);
    return action?.show?.(cipher) ?? true;
  }

  describe("userCanArchive", () => {
    it("reflects the current value from CipherArchiveService", () => {
      expect(service.userCanArchive()).toBe(false);
      userCanArchiveSubject.next(true);
      expect(service.userCanArchive()).toBe(true);
    });
  });

  describe("addFavorite", () => {
    it("shows for a normal non-favorite cipher", () => {
      expect(show("addFavorite", makeCipher())).toBe(true);
    });

    it("hides when the cipher is already favorited", () => {
      expect(show("addFavorite", makeCipher({ favorite: true }))).toBe(false);
    });

    it("hides when deleted", () => {
      expect(show("addFavorite", makeCipher({ isDeleted: true }))).toBe(false);
    });

    it("hides when archived and user cannot archive", () => {
      expect(show("addFavorite", makeCipher({ isArchived: true }))).toBe(false);
    });

    it("shows when archived and user can archive", () => {
      userCanArchiveSubject.next(true);
      expect(show("addFavorite", makeCipher({ isArchived: true }))).toBe(true);
    });
  });

  describe("removeFavorite", () => {
    it("shows for a favorited cipher", () => {
      expect(show("removeFavorite", makeCipher({ favorite: true }))).toBe(true);
    });

    it("hides when the cipher is not favorited", () => {
      expect(show("removeFavorite", makeCipher())).toBe(false);
    });

    it("hides when deleted", () => {
      expect(show("removeFavorite", makeCipher({ favorite: true, isDeleted: true }))).toBe(false);
    });

    it("hides when archived and user cannot archive", () => {
      expect(show("removeFavorite", makeCipher({ favorite: true, isArchived: true }))).toBe(false);
    });
  });

  describe("edit", () => {
    it("shows when the cipher is editable and not deleted", () => {
      expect(show("edit", makeCipher())).toBe(true);
    });

    it("hides when deleted", () => {
      expect(show("edit", makeCipher({ isDeleted: true }))).toBe(false);
    });

    it("hides when the cipher is not editable", () => {
      expect(show("edit", makeCipher({ edit: false }))).toBe(false);
    });
  });

  describe("attachments", () => {
    it("shows when editable, not archived, and not deleted", () => {
      expect(show("attachments", makeCipher())).toBe(true);
    });

    it("shows when read-only but has attachments", () => {
      expect(show("attachments", makeCipher({ edit: false, hasAttachments: true }))).toBe(true);
    });

    it("hides when read-only with no attachments", () => {
      expect(show("attachments", makeCipher({ edit: false }))).toBe(false);
    });

    it("hides when archived and user cannot archive", () => {
      expect(show("attachments", makeCipher({ isArchived: true }))).toBe(false);
    });

    it("shows when archived and user can archive", () => {
      userCanArchiveSubject.next(true);
      expect(show("attachments", makeCipher({ isArchived: true }))).toBe(true);
    });

    it("hides when deleted", () => {
      expect(show("attachments", makeCipher({ isDeleted: true }))).toBe(false);
    });
  });

  describe("clone", () => {
    it("shows for a personal cipher that is not deleted or archived", () => {
      expect(show("clone", makeCipher())).toBe(true);
    });

    it("shows for an org cipher when the user manages a matching collection", () => {
      const collectionId = "col-1";
      const collections = [{ id: collectionId, manage: true } as CollectionView];

      expect(
        show(
          "clone",
          makeCipher({ organizationId: "org-1", collectionIds: [collectionId] }),
          collections,
        ),
      ).toBe(true);
    });

    it("hides for an org cipher when no matching collection has manage access", () => {
      const collectionId = "col-1";
      const collections = [{ id: collectionId, manage: false } as CollectionView];

      expect(
        show(
          "clone",
          makeCipher({ organizationId: "org-1", collectionIds: [collectionId] }),
          collections,
        ),
      ).toBe(false);
    });

    it("hides when the cipher type is restricted", () => {
      restrictedTypesSubject.next([{ cipherType: CipherType.Login } as RestrictedCipherType]);

      expect(show("clone", makeCipher({ type: CipherType.Login }))).toBe(false);
    });

    it("shows when a different type is restricted", () => {
      restrictedTypesSubject.next([{ cipherType: CipherType.SecureNote } as RestrictedCipherType]);

      expect(show("clone", makeCipher({ type: CipherType.Login }))).toBe(true);
    });

    it("hides when deleted", () => {
      expect(show("clone", makeCipher({ isDeleted: true }))).toBe(false);
    });

    it("hides when archived and user cannot archive", () => {
      expect(show("clone", makeCipher({ isArchived: true }))).toBe(false);
    });

    it("shows when archived and user can archive", () => {
      userCanArchiveSubject.next(true);
      expect(show("clone", makeCipher({ isArchived: true }))).toBe(true);
    });
  });

  describe("addToSharedFolder", () => {
    /** A member of one organization holding one writable collection in it — the ordinary case. */
    function canAssignSomewhere() {
      organizationsSubject.next([{ id: "org-1" } as Organization]);
      return [{ id: "collection-1", organizationId: "org-1", readOnly: false } as CollectionView];
    }

    it("shows for an organization cipher that can be assigned", () => {
      const collections = canAssignSomewhere();

      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: true }),
          collections,
        ),
      ).toBe(true);
    });

    it("shows for a personal cipher, which is how one is moved into an organization", () => {
      const collections = canAssignSomewhere();

      expect(
        show("addToSharedFolder", makeCipher({ canAssignToCollections: true }), collections),
      ).toBe(true);
    });

    it("hides for an organization cipher when the only writable collections belong to another organization", () => {
      organizationsSubject.next([{ id: "org-1" } as Organization, { id: "org-2" } as Organization]);
      const collections = [
        { id: "collection-2", organizationId: "org-2", readOnly: false } as CollectionView,
      ];

      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: true }),
          collections,
        ),
      ).toBe(false);
    });

    it("hides for an organization cipher when its own organization's collections are all read-only", () => {
      organizationsSubject.next([{ id: "org-1" } as Organization]);
      const collections = [
        { id: "collection-1", organizationId: "org-1", readOnly: true } as CollectionView,
        { id: "collection-2", organizationId: "org-2", readOnly: false } as CollectionView,
      ];

      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: true }),
          collections,
        ),
      ).toBe(false);
    });

    it("shows for a personal cipher using a writable collection in any organization", () => {
      organizationsSubject.next([{ id: "org-2" } as Organization]);
      const collections = [
        { id: "collection-2", organizationId: "org-2", readOnly: false } as CollectionView,
      ];

      expect(
        show("addToSharedFolder", makeCipher({ canAssignToCollections: true }), collections),
      ).toBe(true);
    });

    it("hides when the user belongs to no organization", () => {
      const collections = [
        { id: "collection-1", organizationId: "org-1", readOnly: false } as CollectionView,
      ];

      expect(
        show("addToSharedFolder", makeCipher({ canAssignToCollections: true }), collections),
      ).toBe(false);
    });

    it("hides when the user has no collection they can write to", () => {
      organizationsSubject.next([{ id: "org-1" } as Organization]);
      const readOnly = [
        { id: "collection-1", organizationId: "org-1", readOnly: true } as CollectionView,
      ];

      expect(
        show("addToSharedFolder", makeCipher({ canAssignToCollections: true }), readOnly),
      ).toBe(false);
    });

    it("hides when the user cannot assign to collections", () => {
      const collections = canAssignSomewhere();

      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: false }),
          collections,
        ),
      ).toBe(false);
    });

    it("hides when deleted", () => {
      const collections = canAssignSomewhere();

      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: true, isDeleted: true }),
          collections,
        ),
      ).toBe(false);
    });
  });

  describe("archive", () => {
    it("shows when the user can archive, the cipher is not archived, and not deleted", () => {
      userCanArchiveSubject.next(true);
      expect(show("archive", makeCipher())).toBe(true);
    });

    it("hides when already archived", () => {
      userCanArchiveSubject.next(true);
      expect(show("archive", makeCipher({ isArchived: true }))).toBe(false);
    });

    it("hides when deleted", () => {
      userCanArchiveSubject.next(true);
      expect(show("archive", makeCipher({ isDeleted: true }))).toBe(false);
    });
  });

  describe("unarchive", () => {
    it("shows when archived and not deleted", () => {
      expect(show("unarchive", makeCipher({ isArchived: true }))).toBe(true);
    });

    it("hides when not archived", () => {
      expect(show("unarchive", makeCipher())).toBe(false);
    });

    it("hides when deleted", () => {
      expect(show("unarchive", makeCipher({ isArchived: true, isDeleted: true }))).toBe(false);
    });
  });

  describe("restore", () => {
    it("shows for a deleted personal cipher", () => {
      expect(show("restore", makeCipher({ isDeleted: true }))).toBe(true);
    });

    it("shows for a deleted org cipher when permissions.restore is true", () => {
      expect(
        show(
          "restore",
          makeCipher({
            isDeleted: true,
            organizationId: "org-1",
            permissions: { delete: false, restore: true },
          }),
        ),
      ).toBe(true);
    });

    it("hides for a deleted org cipher when permissions.restore is false", () => {
      expect(
        show(
          "restore",
          makeCipher({
            isDeleted: true,
            organizationId: "org-1",
            permissions: { delete: false, restore: false },
          }),
        ),
      ).toBe(false);
    });

    it("hides when not deleted", () => {
      expect(show("restore", makeCipher())).toBe(false);
    });
  });

  describe("delete", () => {
    it("shows for a personal cipher that is not deleted", () => {
      expect(show("delete", makeCipher())).toBe(true);
    });

    it("shows for an org cipher when permissions.delete is true", () => {
      expect(
        show(
          "delete",
          makeCipher({ organizationId: "org-1", permissions: { delete: true, restore: false } }),
        ),
      ).toBe(true);
    });

    it("hides for an org cipher when permissions.delete is false", () => {
      expect(
        show(
          "delete",
          makeCipher({ organizationId: "org-1", permissions: { delete: false, restore: false } }),
        ),
      ).toBe(false);
    });

    it("hides when already deleted (use permanentlyDelete instead)", () => {
      expect(show("delete", makeCipher({ isDeleted: true }))).toBe(false);
    });
  });

  describe("permanentlyDelete", () => {
    it("shows for a deleted personal cipher", () => {
      expect(show("permanentlyDelete", makeCipher({ isDeleted: true }))).toBe(true);
    });

    it("shows for a deleted org cipher when permissions.delete is true", () => {
      expect(
        show(
          "permanentlyDelete",
          makeCipher({
            isDeleted: true,
            organizationId: "org-1",
            permissions: { delete: true, restore: false },
          }),
        ),
      ).toBe(true);
    });

    it("hides for a deleted org cipher when permissions.delete is false", () => {
      expect(
        show(
          "permanentlyDelete",
          makeCipher({
            isDeleted: true,
            organizationId: "org-1",
            permissions: { delete: false, restore: false },
          }),
        ),
      ).toBe(false);
    });

    it("hides when not in trash (use delete instead)", () => {
      expect(show("permanentlyDelete", makeCipher())).toBe(false);
    });
  });

  describe("a cipher that failed to decrypt", () => {
    function visibleActionIds(cipher: CipherView, collections: CollectionView[] = []): string[] {
      return service
        .getRowActions(collections, {
          edit: () => {},
          clone: () => {},
          assignToCollections: () => {},
        })
        .filter((action) => action.show?.(cipher) ?? true)
        .map((action) => action.id);
    }

    it("offers only Delete", () => {
      expect(visibleActionIds(makeCipher({ decryptionFailure: true }))).toEqual(["delete"]);
    });

    it("offers only Permanently delete once trashed", () => {
      expect(visibleActionIds(makeCipher({ decryptionFailure: true, isDeleted: true }))).toEqual([
        "permanentlyDelete",
      ]);
    });

    it("offers nothing when the user cannot delete it either", () => {
      expect(
        visibleActionIds(
          makeCipher({
            decryptionFailure: true,
            organizationId: "org-1",
            permissions: { delete: false, restore: false },
          }),
        ),
      ).toEqual([]);
    });

    it("leaves a healthy cipher's actions alone", () => {
      expect(visibleActionIds(makeCipher())).toEqual(
        expect.arrayContaining(["addFavorite", "edit", "archive", "delete"]),
      );
    });
  });

  describe("contributed actions (VAULT_ROW_ACTIONS)", () => {
    const handlers = { edit: () => {}, clone: () => {}, assignToCollections: () => {} };

    function contributed(
      id: string,
      overrides: Partial<VaultItemsTableRowAction<CipherViewLike>> = {},
    ): VaultItemsTableRowAction<CipherViewLike> {
      return { id, label: id, icon: "bwi-key", run: () => {}, ...overrides };
    }

    /** Rebuilds the service with `actions` provided under `VAULT_ROW_ACTIONS`. */
    function serviceWith(
      actions: readonly VaultItemsTableRowAction<CipherViewLike>[],
    ): CipherRowMenuService {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [...providers, { provide: VAULT_ROW_ACTIONS, useValue: actions }],
      });
      return TestBed.inject(CipherRowMenuService);
    }

    /** Runs `fn` with `isDevMode()` returning `false`, as in a production build. */
    function inProduction<T>(fn: () => T): T {
      // `isDevMode()` reads the `ngDevMode` global; `false` is what a production build sees.
      const global = globalThis as { ngDevMode?: unknown };
      const devMode = global.ngDevMode;
      global.ngDevMode = false;
      try {
        return fn();
      } finally {
        global.ngDevMode = devMode;
      }
    }

    const ids = (s: CipherRowMenuService) => s.getRowActions([], handlers).map((a) => a.id);

    it("leaves the list unchanged without a provider", () => {
      expect(ids(service)).toEqual([
        "addFavorite",
        "removeFavorite",
        "edit",
        "attachments",
        "clone",
        "addToSharedFolder",
        "archive",
        "unarchive",
        "restore",
        "delete",
        "permanentlyDelete",
      ]);
    });

    it("puts a contributed action after restore and before delete", () => {
      const list = ids(serviceWith([contributed("cancelRequest")]));

      expect(list.slice(list.indexOf("restore"), list.indexOf("delete") + 1)).toEqual([
        "restore",
        "cancelRequest",
        "delete",
      ]);
    });

    it("hides a contributed action for a cipher that failed to decrypt", () => {
      const action = serviceWith([contributed("cancelRequest")])
        .getRowActions([], handlers)
        .find((a) => a.id === "cancelRequest")!;

      expect(action.show!(makeCipher())).toBe(true);
      expect(action.show!(makeCipher({ decryptionFailure: true }))).toBe(false);
    });

    it("passes the row to show and run", () => {
      const show = jest.fn().mockReturnValue(true);
      const run = jest.fn();
      const cipher = makeCipher({ id: "row-id" });
      const action = serviceWith([contributed("cancelRequest", { show, run })])
        .getRowActions([], handlers)
        .find((a) => a.id === "cancelRequest")!;

      expect(action.show!(cipher)).toBe(true);
      void action.run(cipher);

      expect(show).toHaveBeenCalledWith(cipher);
      expect(run).toHaveBeenCalledWith(cipher);
    });

    it("throws in dev mode when an ID matches a built-in action", () => {
      expect(() => serviceWith([contributed("delete")])).toThrow(/"delete"/);
    });

    it("throws in dev mode when a contributed ID repeats", () => {
      expect(() =>
        serviceWith([contributed("cancelRequest"), contributed("cancelRequest")]),
      ).toThrow(/"cancelRequest"/);
    });

    it("drops clashing actions in production", () => {
      const list = inProduction(() =>
        serviceWith([
          contributed("delete", { label: "Clash" }),
          contributed("cancelRequest", { label: "First" }),
          contributed("cancelRequest", { label: "Second" }),
        ]).getRowActions([], handlers),
      );

      expect(list.filter((a) => a.id === "delete").map((a) => a.label)).toEqual(["delete"]);
      expect(list.filter((a) => a.id === "cancelRequest").map((a) => a.label)).toEqual(["First"]);
    });
  });

  describe("restricted rows", () => {
    /** Inputs that show each action for an unrestricted cipher. */
    const cases: [string, Parameters<typeof makeCipher>[0]][] = [
      ["addFavorite", {}],
      ["removeFavorite", { favorite: true }],
      ["edit", {}],
      ["attachments", {}],
      ["clone", {}],
      ["addToSharedFolder", { canAssignToCollections: true }],
      ["archive", {}],
      ["unarchive", { isArchived: true }],
      ["restore", { isDeleted: true }],
      ["delete", {}],
      ["permanentlyDelete", { isDeleted: true }],
    ];
    const allowed = new Set(["addFavorite", "removeFavorite", "archive", "unarchive"]);

    beforeEach(() => {
      userCanArchiveSubject.next(true);
      organizationsSubject.next([{ id: "org-1" } as Organization]);
    });

    const collections = () => [
      { id: "collection-1", organizationId: "org-1", readOnly: false } as CollectionView,
    ];

    it.each(cases)("%s shows for an unrestricted row", (actionId, overrides) => {
      expect(show(actionId, makeCipher(overrides), collections())).toBe(true);
    });

    it.each(cases)("%s follows the restricted-cipher policy", (actionId, overrides) => {
      expect(show(actionId, makeCipher({ ...overrides, partial: true }), collections())).toBe(
        allowed.has(actionId),
      );
    });

    it.each(cases)(
      "%s shows for a row that is no longer restricted while its reveal is held",
      (actionId, overrides) => {
        revealedSubject.next(new Map([["revealed-id" as CipherId, new CipherView()]]));

        expect(show(actionId, makeCipher({ ...overrides, id: "revealed-id" }), collections())).toBe(
          true,
        );
      },
    );

    it.each(cases)("%s follows the revealed-cipher policy", (actionId, overrides) => {
      const revealedAllowed = new Set([...allowed, "edit", "attachments"]);
      revealedSubject.next(new Map([["revealed-id" as CipherId, new CipherView()]]));

      expect(
        show(
          actionId,
          makeCipher({ ...overrides, id: "revealed-id", partial: true }),
          collections(),
        ),
      ).toBe(revealedAllowed.has(actionId));
    });
  });
});
