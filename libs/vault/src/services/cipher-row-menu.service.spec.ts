import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

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
  let restrictedItemTypesService: MockProxy<RestrictedItemTypesService>;
  let i18nService: MockProxy<I18nService>;
  let userCanArchiveSubject: BehaviorSubject<boolean>;
  let restrictedTypesSubject: BehaviorSubject<RestrictedCipherType[]>;

  beforeEach(() => {
    cipherArchiveService = mock<CipherArchiveService>();
    restrictedItemTypesService = mock<RestrictedItemTypesService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    userCanArchiveSubject = new BehaviorSubject<boolean>(false);
    restrictedTypesSubject = new BehaviorSubject<RestrictedCipherType[]>([]);

    cipherArchiveService.userCanArchive$.mockReturnValue(userCanArchiveSubject.asObservable());
    Object.defineProperty(restrictedItemTypesService, "restricted$", {
      value: restrictedTypesSubject.asObservable(),
    });

    TestBed.configureTestingModule({
      providers: [
        CipherRowMenuService,
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: RestrictedItemTypesService, useValue: restrictedItemTypesService },
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: CipherActionService, useValue: mock<CipherActionService>() },
      ],
    });

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
    it("shows when the cipher belongs to an org and can be assigned", () => {
      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: true }),
        ),
      ).toBe(true);
    });

    it("hides when the cipher has no organization", () => {
      expect(show("addToSharedFolder", makeCipher({ canAssignToCollections: true }))).toBe(false);
    });

    it("hides when the user cannot assign to collections", () => {
      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: false }),
        ),
      ).toBe(false);
    });

    it("hides when deleted", () => {
      expect(
        show(
          "addToSharedFolder",
          makeCipher({ organizationId: "org-1", canAssignToCollections: true, isDeleted: true }),
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
});
