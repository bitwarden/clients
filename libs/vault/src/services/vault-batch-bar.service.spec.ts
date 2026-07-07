import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView, Unassigned } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { BulkMoveDialogResult } from "../components/bulk-action-dialogs/bulk-move-dialog/bulk-move-dialog.component";
import { VaultItem } from "../components/vault-item";
import { RoutedVaultFilterModel } from "../models/routed-vault-filter.model";
import {
  ASSIGN_COLLECTIONS_DIALOG,
  AssignCollectionsResult,
} from "../tokens/assign-collections-dialog.token";
import { BULK_DELETE_DIALOG, BulkDeleteDialogResult } from "../tokens/bulk-delete-dialog.token";
import {
  BULK_EDIT_COLLECTION_ACCESS_DIALOG,
  BulkEditCollectionAccessResult,
} from "../tokens/bulk-edit-collection-access-dialog.token";

import { PasswordRepromptService } from "./password-reprompt.service";
import { RoutedVaultFilterBridgeService } from "./routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "./routed-vault-filter.service";
import { VaultBatchBarConfig, VaultBatchBarService } from "./vault-batch-bar.service";

const userId = "test-user-id" as UserId;
const orgId = "test-org-id" as OrganizationId;

function makeCipher(overrides: Partial<CipherView> = {}): CipherView {
  return Object.assign(new CipherView(), {
    id: "cipher-1" as unknown as CipherId,
    reprompt: CipherRepromptType.None,
    edit: true,
    viewPassword: true,
    ...overrides,
  });
}

function makeCipherItem(overrides: Partial<CipherView> = {}): VaultItem<CipherView> {
  return { cipher: makeCipher(overrides) };
}

function makeCollection(
  overrides: Partial<CollectionView> = {},
  canDeleteResult = true,
  canEditResult = true,
): CollectionView {
  const col = new CollectionView({
    id: "col-1" as any,
    organizationId: orgId,
    name: "Test Collection",
  } as any);
  Object.assign(col, overrides);
  jest.spyOn(col, "canDelete").mockReturnValue(canDeleteResult);
  jest.spyOn(col, "canEdit").mockReturnValue(canEditResult);
  return col;
}

function makeCollectionItem(
  overrides: Partial<CollectionView> = {},
  canDeleteResult = true,
): VaultItem<CipherView> {
  return { collection: makeCollection(overrides, canDeleteResult) };
}

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: orgId,
    canEditAllCiphers: false,
    canEditUnassignedCiphers: false,
    allowAdminAccessToAllCollectionItems: false,
    permissions: { editAnyCollection: false, deleteAnyCollection: false },
    ...overrides,
  } as unknown as Organization;
}

function makeConfig(overrides: Partial<VaultBatchBarConfig> = {}): VaultBatchBarConfig {
  return { isOrgVault: false, allCollections: [], hasCiphers: true, ...overrides };
}

describe("VaultBatchBarService", () => {
  let service: VaultBatchBarService<CipherView>;
  let mockCipherService: MockProxy<CipherService>;
  let mockCipherArchiveService: MockProxy<CipherArchiveService>;
  let mockCipherAuthorizationService: MockProxy<CipherAuthorizationService>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockPasswordRepromptService: MockProxy<PasswordRepromptService>;
  let mockDialogService: MockProxy<DialogService>;
  let mockToastService: MockProxy<ToastService>;
  let mockAccountService: MockProxy<AccountService>;
  let filterSubject: BehaviorSubject<RoutedVaultFilterModel>;
  let organizationsSubject: BehaviorSubject<Organization[]>;
  let userCanArchiveSubject: BehaviorSubject<boolean>;
  let mockAssignCollectionsDialogOpen: jest.Mock;
  let mockBulkDeleteDialogOpen: jest.Mock;
  let mockBulkEditCollectionAccessDialogOpen: jest.Mock;
  let activeFilterSubject: BehaviorSubject<RoutedVaultFilterModel>;
  let featureFlagSubject: BehaviorSubject<boolean>;

  beforeEach(() => {
    filterSubject = new BehaviorSubject<RoutedVaultFilterModel>({});
    organizationsSubject = new BehaviorSubject<Organization[]>([]);
    userCanArchiveSubject = new BehaviorSubject<boolean>(false);
    activeFilterSubject = new BehaviorSubject<RoutedVaultFilterModel>({});
    featureFlagSubject = new BehaviorSubject<boolean>(false);

    mockCipherService = mock<CipherService>();
    mockCipherArchiveService = mock<CipherArchiveService>();
    mockCipherAuthorizationService = mock<CipherAuthorizationService>();
    mockOrganizationService = mock<OrganizationService>();
    mockPasswordRepromptService = mock<PasswordRepromptService>();
    mockDialogService = mock<DialogService>();
    mockToastService = mock<ToastService>();
    mockAccountService = mock<AccountService>();

    mockAccountService.activeAccount$ = of({ id: userId } as Account);
    mockAssignCollectionsDialogOpen = jest.fn();
    mockBulkDeleteDialogOpen = jest.fn();
    mockBulkEditCollectionAccessDialogOpen = jest.fn();
    mockOrganizationService.organizations$.mockReturnValue(organizationsSubject);
    mockCipherArchiveService.userCanArchive$.mockReturnValue(userCanArchiveSubject);
    mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(true);
    mockCipherService.restoreManyWithServer.mockResolvedValue(undefined);
    mockCipherArchiveService.archiveWithServer.mockResolvedValue(undefined);
    mockCipherArchiveService.unarchiveWithServer.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        VaultBatchBarService,
        { provide: CipherService, useValue: mockCipherService },
        { provide: CipherArchiveService, useValue: mockCipherArchiveService },
        { provide: CipherAuthorizationService, useValue: mockCipherAuthorizationService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: PasswordRepromptService, useValue: mockPasswordRepromptService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: RoutedVaultFilterService, useValue: { filter$: filterSubject } },
        {
          provide: RoutedVaultFilterBridgeService,
          useValue: { activeFilter$: activeFilterSubject },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: jest
              .fn()
              .mockImplementation((flag: FeatureFlag) =>
                flag === FeatureFlag.PM37785_VaultBatchBar ? featureFlagSubject : of(false),
              ),
          },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ASSIGN_COLLECTIONS_DIALOG, useValue: { open: mockAssignCollectionsDialogOpen } },
        { provide: BULK_DELETE_DIALOG, useValue: { open: mockBulkDeleteDialogOpen } },
        {
          provide: BULK_EDIT_COLLECTION_ACCESS_DIALOG,
          useValue: { open: mockBulkEditCollectionAccessDialogOpen },
        },
      ],
    });

    service = TestBed.inject(VaultBatchBarService) as VaultBatchBarService<CipherView>;
  });

  describe("setConfig()", () => {
    it("updates config and is reflected in canAssignToCollections", () => {
      service.setConfig(makeConfig({ hasCiphers: false }));
      expect(service.canAssignToCollections()).toBe(false);

      service.setConfig(makeConfig({ hasCiphers: true, isOrgVault: true }));
      service.selection.select(makeCipherItem());
      expect(service.canAssignToCollections()).toBe(true);
    });
  });

  describe("selection helpers", () => {
    it("selected returns items in SelectionModel", () => {
      const item = makeCipherItem();

      service.selection.select(item);

      expect(service.selected()).toContain(item);
    });

    it("selectedCount reflects selection count", () => {
      expect(service.selectedCount()).toBe(0);

      service.selection.select(makeCipherItem());

      expect(service.selectedCount()).toBe(1);

      service.selection.select(makeCipherItem({ id: "cipher-2" as unknown as CipherId }));

      expect(service.selectedCount()).toBe(2);
    });

    it("selectedCiphers returns only items with a cipher", () => {
      const cipherItem = makeCipherItem();
      const collectionItem = makeCollectionItem();

      service.selection.select(cipherItem, collectionItem);

      expect(service.selectedCiphers()).toHaveLength(1);
      expect(service.selectedCiphers()[0]).toBe(cipherItem.cipher);
    });

    it("selectedCollections returns only items with a collection", () => {
      const cipherItem = makeCipherItem();
      const collectionItem = makeCollectionItem();

      service.selection.select(cipherItem, collectionItem);

      expect(service.selectedCollections()).toHaveLength(1);
      expect(service.selectedCollections()[0]).toBe(collectionItem.collection);
    });
  });

  describe("barVisible()", () => {
    it("returns false when flag is off and nothing is selected", () => {
      featureFlagSubject.next(false);

      expect(service.barVisible()).toBe(false);
    });

    it("returns false when flag is on but nothing is selected", () => {
      featureFlagSubject.next(true);

      expect(service.barVisible()).toBe(false);
    });

    it("returns true when flag is on and at least one item is selected", () => {
      featureFlagSubject.next(true);
      service.selection.select(makeCipherItem());

      expect(service.barVisible()).toBe(true);
    });

    it("returns false after selection is cleared", () => {
      featureFlagSubject.next(true);
      service.selection.select(makeCipherItem());

      expect(service.barVisible()).toBe(true);

      service.selection.clear();

      expect(service.barVisible()).toBe(false);
    });
  });

  describe("canAddToFolder", () => {
    it("returns false when nothing selected", () => {
      expect(service.canAddToFolder()).toBe(false);
    });

    it("returns true when not in trash and no collections selected", () => {
      service.selection.select(makeCipherItem());

      expect(service.canAddToFolder()).toBe(true);
    });

    it("returns false when filter type is trash", () => {
      filterSubject.next({ type: "trash" });

      service.selection.select(makeCipherItem());

      expect(service.canAddToFolder()).toBe(false);
    });

    it("returns false when a collection is in the selection", () => {
      service.selection.select(makeCollectionItem());

      expect(service.canAddToFolder()).toBe(false);
    });

    it("returns false when in org vault", () => {
      service.setConfig(makeConfig({ isOrgVault: true }));
      service.selection.select(makeCipherItem());

      expect(service.canAddToFolder()).toBe(false);
    });
  });

  describe("canArchive", () => {
    it("returns false when nothing selected", () => {
      userCanArchiveSubject.next(true);

      expect(service.canArchive()).toBe(false);
    });

    it("returns false when userCanArchive is false", () => {
      userCanArchiveSubject.next(false);
      service.selection.select(makeCipherItem());

      expect(service.canArchive()).toBe(false);
    });

    it("returns false when a collection is selected", () => {
      userCanArchiveSubject.next(true);
      service.selection.select(makeCollectionItem());

      expect(service.canArchive()).toBe(false);
    });

    it("returns false when in trash view", () => {
      filterSubject.next({ type: "trash" });
      userCanArchiveSubject.next(true);

      service.selection.select(makeCipherItem());

      expect(service.canArchive()).toBe(false);
    });

    it("returns false when any cipher has an organizationId", () => {
      userCanArchiveSubject.next(true);

      service.selection.select(makeCipherItem({ organizationId: orgId }));

      expect(service.canArchive()).toBe(false);
    });

    it("returns false when any cipher has an archivedDate", () => {
      userCanArchiveSubject.next(true);

      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      expect(service.canArchive()).toBe(false);
    });

    it("returns true when personal non-archived ciphers are selected and userCanArchive is true", () => {
      userCanArchiveSubject.next(true);

      service.selection.select(makeCipherItem());

      expect(service.canArchive()).toBe(true);
    });
  });

  describe("canUnarchive", () => {
    it("returns false when nothing selected", () => {
      expect(service.canUnarchive()).toBe(false);
    });

    it("returns false when in trash view", () => {
      filterSubject.next({ type: "trash" });

      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      expect(service.canUnarchive()).toBe(false);
    });

    it("returns false when any cipher has no archivedDate", () => {
      service.selection.select(makeCipherItem());

      expect(service.canUnarchive()).toBe(false);
    });

    it("returns false when any cipher has an organizationId", () => {
      service.selection.select(makeCipherItem({ archivedDate: new Date(), organizationId: orgId }));

      expect(service.canUnarchive()).toBe(false);
    });

    it("returns true when all selected ciphers are archived personal items", () => {
      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      expect(service.canUnarchive()).toBe(true);
    });
  });

  describe("canRestore", () => {
    beforeEach(() => {
      mockCipherAuthorizationService.canRestoreCipher$.mockReturnValue(of(true));
    });

    it("returns true initially when nothing is selected", () => {
      TestBed.tick();

      expect(service.canRestore()).toBe(true);
    });

    it("returns false when only collections are selected", () => {
      service.selection.select(makeCollectionItem());
      TestBed.tick();

      expect(service.canRestore()).toBe(false);
    });

    it("returns true when in trash view and all ciphers pass canRestoreCipher$", () => {
      filterSubject.next({ type: "trash" });

      service.selection.select(makeCipherItem());
      TestBed.tick();

      expect(service.canRestore()).toBe(true);
    });

    it("returns false when not in trash view even if ciphers pass canRestoreCipher$", () => {
      filterSubject.next({});
      service.selection.select(makeCipherItem());
      TestBed.tick();

      expect(service.canRestore()).toBe(false);
    });

    it("returns false when a cipher fails canRestoreCipher$", () => {
      filterSubject.next({ type: "trash" });
      mockCipherAuthorizationService.canRestoreCipher$.mockReturnValue(of(false));

      service.selection.select(makeCipherItem());
      TestBed.tick();

      expect(service.canRestore()).toBe(false);
    });
  });

  describe("canDelete", () => {
    beforeEach(() => {
      mockCipherAuthorizationService.canDeleteCipher$.mockReturnValue(of(true));
    });

    it("returns true initially when nothing is selected", () => {
      TestBed.tick();

      expect(service.canDelete()).toBe(true);
    });

    it("returns true when all ciphers pass canDeleteCipher$", () => {
      service.selection.select(makeCipherItem());
      TestBed.tick();

      expect(service.canDelete()).toBe(true);
    });

    it("returns false when any cipher fails canDeleteCipher$", () => {
      mockCipherAuthorizationService.canDeleteCipher$.mockReturnValue(of(false));
      service.selection.select(makeCipherItem());
      TestBed.tick();

      expect(service.canDelete()).toBe(false);
    });

    it("returns false when a collection has id === Unassigned", () => {
      service.selection.select(makeCollectionItem({ id: Unassigned as any }));
      TestBed.tick();

      expect(service.canDelete()).toBe(false);
    });

    it("returns false when a collection's canDelete returns false", () => {
      organizationsSubject.next([makeOrg()]);
      service.selection.select(makeCollectionItem({}, false));
      TestBed.tick();

      expect(service.canDelete()).toBe(false);
    });

    it("returns true when collections can be deleted", () => {
      organizationsSubject.next([makeOrg()]);
      service.selection.select(makeCollectionItem({}, true));
      TestBed.tick();

      expect(service.canDelete()).toBe(true);
    });
  });

  describe("canAssignToCollections", () => {
    it("returns false when config.hasCiphers is false", () => {
      service.setConfig(makeConfig({ hasCiphers: false }));

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns false when any selected cipher is archived", () => {
      service.setConfig(makeConfig({ hasCiphers: true }));
      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns true for org vault when hasCiphers is true and ciphers are selected", () => {
      service.setConfig(makeConfig({ hasCiphers: true, isOrgVault: true }));
      service.selection.select(makeCipherItem());

      expect(service.canAssignToCollections()).toBe(true);
    });

    it("returns false for org vault when only collections are selected", () => {
      service.setConfig(makeConfig({ hasCiphers: true, isOrgVault: true }));
      service.selection.select(makeCollectionItem());

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns false when in trash view", () => {
      filterSubject.next({ type: "trash" });
      service.setConfig(makeConfig({ hasCiphers: true }));
      organizationsSubject.next([makeOrg()]);

      service.selection.select(makeCipherItem());

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns false when no organizations available", () => {
      service.setConfig(makeConfig({ hasCiphers: true }));
      organizationsSubject.next([]);
      service.selection.select(makeCipherItem());

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns false when nothing is selected", () => {
      service.setConfig(makeConfig({ hasCiphers: true }));
      organizationsSubject.next([makeOrg()]);

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns false when ciphers from multiple orgs are selected", () => {
      service.setConfig(
        makeConfig({
          hasCiphers: true,
          allCollections: [makeCollection({ readOnly: false } as any)],
        }),
      );
      organizationsSubject.next([makeOrg(), makeOrg({ id: "org-2" as OrganizationId })]);
      service.selection.select(
        makeCipherItem({ organizationId: orgId }),
        makeCipherItem({
          id: "cipher-2" as unknown as CipherId,
          organizationId: "org-2" as OrganizationId,
        }),
      );

      expect(service.canAssignToCollections()).toBe(false);
    });

    it("returns true when personal items with editable collections and org available", () => {
      const editableCollection = makeCollection();
      (editableCollection as any).readOnly = false;
      service.setConfig(
        makeConfig({
          hasCiphers: true,
          allCollections: [editableCollection],
        }),
      );
      organizationsSubject.next([makeOrg()]);
      service.selection.select(makeCipherItem());

      expect(service.canAssignToCollections()).toBe(true);
    });

    it("returns true in personal vault when org admin (canEditAllCiphers) selects org cipher without individual edit permission", () => {
      const editableCollection = makeCollection();
      (editableCollection as any).readOnly = false;
      service.setConfig(
        makeConfig({
          hasCiphers: true,
          allCollections: [editableCollection],
        }),
      );
      organizationsSubject.next([makeOrg({ canEditAllCiphers: true })]);
      service.selection.select(
        makeCipherItem({ organizationId: orgId, edit: false, viewPassword: false }),
      );

      expect(service.canAssignToCollections()).toBe(true);
    });

    it("returns false in personal vault when org admin (canEditAllCiphers) but cipher is from a different org", () => {
      const editableCollection = makeCollection();
      (editableCollection as any).readOnly = false;
      service.setConfig(
        makeConfig({
          hasCiphers: true,
          allCollections: [editableCollection],
        }),
      );
      organizationsSubject.next([makeOrg({ canEditAllCiphers: true })]);
      service.selection.select(
        makeCipherItem({
          organizationId: "other-org" as OrganizationId,
          edit: false,
          viewPassword: false,
        }),
      );

      expect(service.canAssignToCollections()).toBe(false);
    });
  });

  describe("filter change clears selection", () => {
    it("clears selection when a relevant filter property changes", () => {
      service.selection.select(makeCipherItem());
      expect(service.selectedCount()).toBe(1);

      filterSubject.next({ organizationId: orgId });
      expect(service.selectedCount()).toBe(0);
    });

    it("does not clear selection when only unrelated filter properties differ", () => {
      filterSubject.next({ organizationId: orgId, collectionId: "col-1" as any });
      service.selection.select(makeCipherItem());
      expect(service.selectedCount()).toBe(1);

      // Same organizationId/collectionId/folderId/type/organizationIdParamType → no clear
      filterSubject.next({ organizationId: orgId, collectionId: "col-1" as any });
      expect(service.selectedCount()).toBe(1);
    });
  });

  describe("bulkArchive()", () => {
    beforeEach(() => {
      userCanArchiveSubject.next(true);
    });

    it("does nothing when reprompt is denied", async () => {
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      service.selection.select(makeCipherItem({ reprompt: CipherRepromptType.Password }));

      await service.bulkArchive();

      expect(mockCipherArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });

    it("does nothing when confirmation dialog is cancelled", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);
      service.selection.select(makeCipherItem());

      await service.bulkArchive();

      expect(mockCipherArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });

    it("calls archiveWithServer with correct args on confirm", async () => {
      const cipher = makeCipher();
      service.selection.select({ cipher });
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      await service.bulkArchive();

      expect(mockCipherArchiveService.archiveWithServer).toHaveBeenCalledWith([cipher.id], userId);
    });

    it("shows success toast, clears selection, and emits completed$ on success", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.selection.select(makeCipherItem());
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      await service.bulkArchive();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });

    it("shows error toast and does NOT clear selection on failure", async () => {
      service.selection.select(makeCipherItem());
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockCipherArchiveService.archiveWithServer.mockRejectedValue(new Error("fail"));

      await service.bulkArchive();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(service.selectedCount()).toBe(1);
    });
  });

  describe("bulkUnarchive()", () => {
    it("does nothing when reprompt is denied", async () => {
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      service.selection.select(makeCipherItem({ reprompt: CipherRepromptType.Password }));

      await service.bulkUnarchive();

      expect(mockCipherArchiveService.unarchiveWithServer).not.toHaveBeenCalled();
    });

    it("calls unarchiveWithServer with correct args", async () => {
      const cipher = makeCipher({ archivedDate: new Date() });
      service.selection.select({ cipher });

      await service.bulkUnarchive();

      expect(mockCipherArchiveService.unarchiveWithServer).toHaveBeenCalledWith(
        [cipher.id],
        userId,
      );
    });

    it("shows success toast, clears selection, and emits completed$ on success", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      await service.bulkUnarchive();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });

    it("shows error toast on failure", async () => {
      mockCipherArchiveService.unarchiveWithServer.mockRejectedValue(new Error("fail"));
      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      await service.bulkUnarchive();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  describe("bulkRestore()", () => {
    beforeEach(() => {
      mockCipherAuthorizationService.canRestoreCipher$.mockReturnValue(of(true));
    });

    it("shows error toast when canRestoreCipher$ returns false", async () => {
      mockCipherAuthorizationService.canRestoreCipher$.mockReturnValue(of(false));
      service.selection.select(makeCipherItem());

      await service.bulkRestore();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(mockCipherService.restoreManyWithServer).not.toHaveBeenCalled();
    });

    it("proceeds to restore when canRestoreCipher$ returns true regardless of cipher edit permission", async () => {
      service.selection.select(makeCipherItem({ edit: false }));

      await service.bulkRestore();

      expect(mockToastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "missingPermissions" }),
      );
      expect(mockCipherService.restoreManyWithServer).toHaveBeenCalled();
    });

    it("passes isOrgVault to canRestoreCipher$", async () => {
      service.setConfig(makeConfig({ isOrgVault: true, organization: makeOrg() }));
      service.selection.select(makeCipherItem({ organizationId: orgId }));

      await service.bulkRestore();

      expect(mockCipherAuthorizationService.canRestoreCipher$).toHaveBeenCalledWith(
        expect.anything(),
        true,
      );
    });

    it("does nothing when reprompt is denied", async () => {
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      service.selection.select(makeCipherItem({ reprompt: CipherRepromptType.Password }));

      await service.bulkRestore();

      expect(mockCipherService.restoreManyWithServer).not.toHaveBeenCalled();
    });

    it("calls restoreManyWithServer for personal vault ciphers", async () => {
      const cipher = makeCipher();
      service.selection.select({ cipher });

      await service.bulkRestore();

      expect(mockCipherService.restoreManyWithServer).toHaveBeenCalledWith([cipher.id], userId);
    });

    it("shows 'restoredItem' toast when a single cipher is not archived", async () => {
      service.selection.select(makeCipherItem());

      await service.bulkRestore();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "restoredItem" }),
      );
    });

    it("shows 'archivedItemRestored' toast when a single archived cipher is restored", async () => {
      service.selection.select(makeCipherItem({ archivedDate: new Date() }));

      await service.bulkRestore();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "archivedItemRestored" }),
      );
    });

    it("clears selection and emits completed$ on success", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.selection.select(makeCipherItem());

      await service.bulkRestore();

      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });

    it("shows error toast and does NOT clear selection on failure", async () => {
      mockCipherService.restoreManyWithServer.mockRejectedValue(new Error("fail"));
      service.selection.select(makeCipherItem());

      await service.bulkRestore();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(service.selectedCount()).toBeGreaterThan(0);
    });

    it("shows error toast when org vault has empty cipher arrays", async () => {
      const org = makeOrg({ canEditAllCiphers: false });
      service.setConfig(makeConfig({ organization: org }));

      // No ciphers selected — both editAccessCiphers and unassignedCiphers will be empty
      await service.bulkRestore();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  describe("bulkDelete()", () => {
    beforeEach(() => {
      mockCipherAuthorizationService.canDeleteCipher$.mockReturnValue(of(true));
    });

    it("shows error toast when nothing is selected", async () => {
      await service.bulkDelete();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("does nothing when reprompt is denied", async () => {
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      service.selection.select(makeCipherItem({ reprompt: CipherRepromptType.Password }));

      await service.bulkDelete();

      expect(mockBulkDeleteDialogOpen).not.toHaveBeenCalled();
    });

    it("shows error toast when canDeleteCipher$ returns false", async () => {
      mockCipherAuthorizationService.canDeleteCipher$.mockReturnValue(of(false));
      service.selection.select(makeCipherItem());

      await service.bulkDelete();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(mockBulkDeleteDialogOpen).not.toHaveBeenCalled();
    });

    it("proceeds to delete when canDeleteCipher$ returns true regardless of cipher edit permission", async () => {
      service.selection.select(makeCipherItem({ edit: false }));
      mockBulkDeleteDialogOpen.mockResolvedValue(BulkDeleteDialogResult.Canceled);

      await service.bulkDelete();

      expect(mockBulkDeleteDialogOpen).toHaveBeenCalled();
      expect(mockToastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: "missingPermissions" }),
      );
    });

    it("passes isOrgVault to canDeleteCipher$", async () => {
      service.setConfig(makeConfig({ isOrgVault: true, organization: makeOrg() }));
      service.selection.select(makeCipherItem({ organizationId: orgId }));
      mockBulkDeleteDialogOpen.mockResolvedValue(BulkDeleteDialogResult.Canceled);

      await service.bulkDelete();

      expect(mockCipherAuthorizationService.canDeleteCipher$).toHaveBeenCalledWith(
        expect.anything(),
        true,
      );
    });

    it("shows error toast when collection cannot be deleted", async () => {
      organizationsSubject.next([makeOrg()]);
      service.selection.select(makeCollectionItem({}, false));

      await service.bulkDelete();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(mockBulkDeleteDialogOpen).not.toHaveBeenCalled();
    });

    it("opens BulkDeleteDialog with permanent=false outside trash", async () => {
      service.selection.select(makeCipherItem());
      mockBulkDeleteDialogOpen.mockResolvedValue(BulkDeleteDialogResult.Canceled);

      await service.bulkDelete();

      expect(mockBulkDeleteDialogOpen).toHaveBeenCalledWith(
        expect.objectContaining({ permanent: false }),
      );
    });

    it("opens BulkDeleteDialog with permanent=true in trash", async () => {
      filterSubject.next({ type: "trash" });
      service.selection.select(makeCipherItem());
      mockBulkDeleteDialogOpen.mockResolvedValue(BulkDeleteDialogResult.Canceled);

      await service.bulkDelete();

      expect(mockBulkDeleteDialogOpen).toHaveBeenCalledWith(
        expect.objectContaining({ permanent: true }),
      );
    });

    it("clears selection and emits completed$ when dialog returns Deleted", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.selection.select(makeCipherItem());
      mockBulkDeleteDialogOpen.mockResolvedValue(BulkDeleteDialogResult.Deleted);
      await service.bulkDelete();
      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });

    it("does NOT clear selection when dialog is cancelled", async () => {
      service.selection.select(makeCipherItem());
      mockBulkDeleteDialogOpen.mockResolvedValue(BulkDeleteDialogResult.Canceled);

      await service.bulkDelete();

      expect(service.selectedCount()).toBe(1);
    });
  });

  describe("bulkMoveToFolder()", () => {
    it("does nothing when reprompt is denied", async () => {
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      service.selection.select(makeCipherItem({ reprompt: CipherRepromptType.Password }));

      await service.bulkMoveToFolder();

      expect(mockDialogService.open).not.toHaveBeenCalled();
    });

    it("shows error toast when no ciphers selected", async () => {
      await service.bulkMoveToFolder();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("opens BulkMoveDialog with correct cipher IDs", async () => {
      const cipher = makeCipher();
      service.selection.select({ cipher });
      mockDialogService.open.mockReturnValue({
        closed: of(BulkMoveDialogResult.Canceled),
      } as any);

      await service.bulkMoveToFolder();

      expect(mockDialogService.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ cipherIds: [cipher.id] }),
        }),
      );
    });

    it("clears selection and emits completed$ when dialog returns Moved", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.selection.select(makeCipherItem());
      mockDialogService.open.mockReturnValue({
        closed: of(BulkMoveDialogResult.Moved),
      } as any);

      await service.bulkMoveToFolder();

      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe("bulkAssignToCollections()", () => {
    it("does nothing when reprompt is denied", async () => {
      mockPasswordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      service.selection.select(makeCipherItem({ reprompt: CipherRepromptType.Password }));

      await service.bulkAssignToCollections();

      expect(mockAssignCollectionsDialogOpen).not.toHaveBeenCalled();
    });

    it("shows error toast when no ciphers selected", async () => {
      await service.bulkAssignToCollections();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("opens assign-collections dialog with CipherView instances", async () => {
      const cipher = makeCipher();
      service.selection.select({ cipher });
      mockAssignCollectionsDialogOpen.mockResolvedValue(AssignCollectionsResult.Canceled);

      await service.bulkAssignToCollections();

      expect(mockAssignCollectionsDialogOpen).toHaveBeenCalledWith(
        expect.objectContaining({ ciphers: [cipher] }),
      );
    });

    it("clears selection and emits completed$ when result is Saved", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.selection.select(makeCipherItem());
      mockAssignCollectionsDialogOpen.mockResolvedValue(AssignCollectionsResult.Saved);

      await service.bulkAssignToCollections();

      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });

    it("does not clear selection when result is Canceled", async () => {
      service.selection.select(makeCipherItem());
      mockAssignCollectionsDialogOpen.mockResolvedValue(AssignCollectionsResult.Canceled);

      await service.bulkAssignToCollections();

      expect(service.selectedCount()).toBe(1);
    });
  });

  describe("canEditCollectionAccess", () => {
    it("returns false when not isOrgVault", () => {
      service.setConfig(makeConfig({ isOrgVault: false }));
      service.selection.select(makeCollectionItem());

      expect(service.canEditCollectionAccess()).toBe(false);
    });

    it("returns false when selection is empty", () => {
      service.setConfig(makeConfig({ isOrgVault: true }));

      expect(service.canEditCollectionAccess()).toBe(false);
    });

    it("returns false when selection contains only ciphers", () => {
      service.setConfig(makeConfig({ isOrgVault: true }));
      service.selection.select(makeCipherItem());

      expect(service.canEditCollectionAccess()).toBe(false);
    });

    it("returns true when isOrgVault and selection contains a collection", () => {
      service.setConfig(makeConfig({ isOrgVault: true }));
      service.selection.select(makeCollectionItem());

      expect(service.canEditCollectionAccess()).toBe(true);
    });

    it("returns true when isOrgVault and selection contains both a cipher and a collection", () => {
      service.setConfig(makeConfig({ isOrgVault: true }));
      service.selection.select(makeCipherItem(), makeCollectionItem());

      expect(service.canEditCollectionAccess()).toBe(true);
    });
  });

  describe("bulkEditCollectionAccess()", () => {
    it("shows error toast when a collection cannot be edited", async () => {
      const org = makeOrg();
      service.setConfig(makeConfig({ isOrgVault: true, organization: org }));
      service.selection.select({ collection: makeCollection({}, true, false) });

      await service.bulkEditCollectionAccess();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(mockBulkEditCollectionAccessDialogOpen).not.toHaveBeenCalled();
    });

    it("opens dialog with correct params when all collections can be edited", async () => {
      const org = makeOrg();
      service.setConfig(makeConfig({ isOrgVault: true, organization: org }));
      const col = makeCollection({}, true, true);
      service.selection.select({ collection: col });
      mockBulkEditCollectionAccessDialogOpen.mockResolvedValue(
        BulkEditCollectionAccessResult.Canceled,
      );

      await service.bulkEditCollectionAccess();

      expect(mockBulkEditCollectionAccessDialogOpen).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: org.id, collections: [col] }),
      );
    });

    it("clears selection and emits completed$ when result is Saved", async () => {
      const completedSpy = jest.fn();
      service.completed$.subscribe(completedSpy);
      service.setConfig(makeConfig({ isOrgVault: true, organization: makeOrg() }));
      service.selection.select({ collection: makeCollection({}, true, true) });
      mockBulkEditCollectionAccessDialogOpen.mockResolvedValue(
        BulkEditCollectionAccessResult.Saved,
      );

      await service.bulkEditCollectionAccess();

      expect(service.selectedCount()).toBe(0);
      expect(completedSpy).toHaveBeenCalled();
    });

    it("does not clear selection when result is Canceled", async () => {
      service.setConfig(makeConfig({ isOrgVault: true, organization: makeOrg() }));
      service.selection.select({ collection: makeCollection({}, true, true) });
      mockBulkEditCollectionAccessDialogOpen.mockResolvedValue(
        BulkEditCollectionAccessResult.Canceled,
      );

      await service.bulkEditCollectionAccess();

      expect(service.selectedCount()).toBe(1);
    });
  });
});
