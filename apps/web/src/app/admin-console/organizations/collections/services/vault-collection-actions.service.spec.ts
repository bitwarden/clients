// jest.mock is hoisted before imports, allowing openCollectionDialog to be intercepted.
jest.mock("../../shared/components/collection-dialog", () => ({
  ...jest.requireActual("../../shared/components/collection-dialog"),
  openCollectionDialog: jest.fn(),
}));

import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  CollectionAdminView,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { RoutedVaultFilterService } from "@bitwarden/vault";

import {
  CollectionDialogAction,
  CollectionDialogResult,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../shared/components/collection-dialog";
import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "../bulk-collections-dialog";

import { VaultCollectionActionsService } from "./vault-collection-actions.service";
import { VaultCollectionService } from "./vault-collection.service";

const USER_ID = "user-1" as UserId;
const ORG_ID = "org-1" as OrganizationId;

function makeDialogRef<T>(result: T): DialogRef<T> {
  return { closed: of(result) } as unknown as DialogRef<T>;
}

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    canEditAnyCollection: true,
    canEditAllCiphers: true,
    ...overrides,
  } as Organization;
}

function buildCollection(overrides: Partial<CollectionAdminView> = {}): CollectionAdminView {
  return {
    id: "col-1" as CollectionId,
    name: "Test Collection",
    organizationId: ORG_ID,
    unmanaged: false,
    canDelete: jest.fn().mockReturnValue(true),
    canEdit: jest.fn().mockReturnValue(true),
    ...overrides,
  } as unknown as CollectionAdminView;
}

function buildTreeNode(
  collection: CollectionAdminView,
  parent: TreeNode<CollectionAdminView> | null = null,
): TreeNode<CollectionAdminView> {
  return new TreeNode<CollectionAdminView>(collection, parent, collection.name);
}

describe("VaultCollectionActionsService", () => {
  let service: VaultCollectionActionsService;
  let apiService: MockProxy<ApiService>;
  let collectionService: MockProxy<CollectionService>;
  let cipherService: MockProxy<CipherService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;
  let i18nService: MockProxy<I18nService>;
  let router: MockProxy<Router>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;
  let routedVaultFilterService: MockProxy<RoutedVaultFilterService>;
  let vaultCollectionService: MockProxy<VaultCollectionService>;

  let selectedCollection$: BehaviorSubject<TreeNode<CollectionAdminView> | undefined>;
  let messageSubject: Subject<{ command: string; [key: string]: unknown }>;
  let refreshEmitted: boolean;

  const organization = buildOrg();

  beforeEach(() => {
    apiService = mock<ApiService>();
    collectionService = mock<CollectionService>();
    cipherService = mock<CipherService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    i18nService = mock<I18nService>();
    router = mock<Router>();
    organizationService = mock<OrganizationService>();
    accountService = mock<AccountService>();
    routedVaultFilterService = mock<RoutedVaultFilterService>();
    vaultCollectionService = mock<VaultCollectionService>();

    i18nService.t.mockReturnValue("translated");
    apiService.deleteCollection.mockResolvedValue(undefined);
    collectionService.delete.mockResolvedValue(undefined);
    cipherService.clear.mockResolvedValue(undefined);

    selectedCollection$ = new BehaviorSubject<TreeNode<CollectionAdminView> | undefined>(undefined);
    messageSubject = new Subject();

    accountService.activeAccount$ = of({ id: USER_ID } as any);
    routedVaultFilterService.filter$ = of({ organizationId: ORG_ID } as any);
    organizationService.organizations$.mockReturnValue(of([organization]));
    Object.defineProperty(vaultCollectionService, "selectedCollection$", {
      get: () => selectedCollection$,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        VaultCollectionActionsService,
        { provide: ApiService, useValue: apiService },
        { provide: CollectionService, useValue: collectionService },
        { provide: CipherService, useValue: cipherService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: router },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: RoutedVaultFilterService, useValue: routedVaultFilterService },
        { provide: VaultCollectionService, useValue: vaultCollectionService },
        { provide: MessageListener, useValue: new MessageListener(messageSubject.asObservable()) },
      ],
    });

    service = TestBed.inject(VaultCollectionActionsService);

    refreshEmitted = false;
    service.refresh$.subscribe(() => {
      refreshEmitted = true;
    });
  });

  describe("addCollection", () => {
    it("opens the collection dialog with organization and parent collection params", async () => {
      const parent = buildCollection({ id: "parent-col" as CollectionId });
      selectedCollection$.next(buildTreeNode(parent));

      jest.mocked(openCollectionDialog).mockReturnValue(makeDialogRef(undefined));

      await service.addCollection();

      expect(openCollectionDialog).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: ORG_ID,
            parentCollectionId: "parent-col",
            isAdminConsoleActive: true,
          }),
        }),
      );
    });

    it("emits on refresh$ when dialog action is Saved", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Saved,
          collection: buildCollection(),
        }),
      );

      await service.addCollection();

      expect(refreshEmitted).toBe(true);
    });

    it("emits on refresh$ when dialog action is Deleted", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Deleted,
          collection: buildCollection(),
        }),
      );

      await service.addCollection();

      expect(refreshEmitted).toBe(true);
    });

    it("does not emit on refresh$ when dialog is cancelled", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(makeDialogRef(undefined));

      await service.addCollection();

      expect(refreshEmitted).toBe(false);
    });
  });

  describe("editCollection", () => {
    it("opens the dialog with the collection and organization params", async () => {
      const collection = buildCollection();
      jest.mocked(openCollectionDialog).mockReturnValue(makeDialogRef(undefined));

      await service.editCollection(collection, CollectionDialogTabType.Info, false);

      expect(openCollectionDialog).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            collectionId: collection.id,
            organizationId: ORG_ID,
            initialTab: CollectionDialogTabType.Info,
            readonly: false,
            isAdminConsoleActive: true,
          }),
        }),
      );
    });

    it("emits on refresh$ when dialog action is Saved", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Saved,
          collection: buildCollection(),
        }),
      );

      await service.editCollection(buildCollection(), CollectionDialogTabType.Info, false);

      expect(refreshEmitted).toBe(true);
    });

    it("emits on refresh$ when dialog action is Deleted", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Deleted,
          collection: buildCollection(),
        }),
      );

      await service.editCollection(buildCollection(), CollectionDialogTabType.Info, false);

      expect(refreshEmitted).toBe(true);
    });

    it("navigates away when the deleted collection was the currently selected one", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const parentCol = buildCollection({ id: "parent-col" as CollectionId });
      const parentNode = buildTreeNode(parentCol);
      selectedCollection$.next(buildTreeNode(collection, parentNode));

      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Deleted,
          collection: buildCollection(),
        }),
      );

      await service.editCollection(collection, CollectionDialogTabType.Info, false);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { collectionId: "parent-col" },
        }),
      );
    });

    it("does not navigate when a different collection was deleted", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const otherCollection = buildCollection({ id: "other-col" as CollectionId });
      selectedCollection$.next(buildTreeNode(otherCollection));

      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Deleted,
          collection: buildCollection(),
        }),
      );

      await service.editCollection(collection, CollectionDialogTabType.Info, false);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does not navigate when the dialog action is Saved (not Deleted)", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      selectedCollection$.next(buildTreeNode(collection));

      jest.mocked(openCollectionDialog).mockReturnValue(
        makeDialogRef<CollectionDialogResult>({
          action: CollectionDialogAction.Saved,
          collection: buildCollection(),
        }),
      );

      await service.editCollection(collection, CollectionDialogTabType.Info, false);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does not emit on refresh$ when dialog is cancelled", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(makeDialogRef(undefined));

      await service.editCollection(buildCollection(), CollectionDialogTabType.Info, false);

      expect(refreshEmitted).toBe(false);
    });
  });

  describe("deleteCollection", () => {
    it("shows permissions error and returns early when collection cannot be deleted", async () => {
      const collection = buildCollection({ canDelete: jest.fn().mockReturnValue(false) });

      await service.deleteCollection(collection);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(apiService.deleteCollection).not.toHaveBeenCalled();
    });

    it("returns early without deleting when user cancels the confirmation", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.deleteCollection(collection);

      expect(apiService.deleteCollection).not.toHaveBeenCalled();
    });

    it("calls deleteCollection on apiService with the correct org and collection ids", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(apiService.deleteCollection).toHaveBeenCalledWith(ORG_ID, collection.id);
    });

    it("calls collectionService.delete with the collection id", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(collectionService.delete).toHaveBeenCalledWith([collection.id], USER_ID);
    });

    it("clears the cipher cache after deletion", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(cipherService.clear).toHaveBeenCalled();
    });

    it("shows a success toast after deletion", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("emits on refresh$ after successful deletion", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(refreshEmitted).toBe(true);
    });

    it("navigates away when the deleted collection is the currently viewed one", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const parentCol = buildCollection({ id: "parent-col" as CollectionId });
      const parentNode = buildTreeNode(parentCol);
      selectedCollection$.next(buildTreeNode(collection, parentNode));
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { collectionId: "parent-col" },
        }),
      );
    });

    it("does not navigate when a different collection is currently viewed", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const otherCol = buildCollection({ id: "other-col" as CollectionId });
      selectedCollection$.next(buildTreeNode(otherCol));
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("logs an error and does not emit on refresh$ when deletion throws", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      apiService.deleteCollection.mockRejectedValue(new Error("server error"));

      await service.deleteCollection(collection);

      expect(logService.error).toHaveBeenCalled();
      expect(refreshEmitted).toBe(false);
    });
  });

  describe("bulkEditCollectionAccess", () => {
    it("shows error toast and returns early when no collections are provided", async () => {
      await service.bulkEditCollectionAccess([], organization);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("shows permissions error when any collection cannot be edited", async () => {
      const col = { canEdit: jest.fn().mockReturnValue(false) } as unknown as CollectionView;

      await service.bulkEditCollectionAccess([col], organization);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("opens the bulk collections dialog with the correct params", async () => {
      const col = { canEdit: jest.fn().mockReturnValue(true) } as unknown as CollectionView;
      const openSpy = jest
        .spyOn(BulkCollectionsDialogComponent, "open")
        .mockReturnValue(makeDialogRef(undefined) as any);

      await service.bulkEditCollectionAccess([col], organization);

      expect(openSpy).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            collections: [col],
            organizationId: ORG_ID,
          }),
        }),
      );
    });

    it("emits on refresh$ when dialog result is Saved", async () => {
      const col = { canEdit: jest.fn().mockReturnValue(true) } as unknown as CollectionView;
      jest
        .spyOn(BulkCollectionsDialogComponent, "open")
        .mockReturnValue(makeDialogRef(BulkCollectionsDialogResult.Saved) as any);

      await service.bulkEditCollectionAccess([col], organization);

      expect(refreshEmitted).toBe(true);
    });

    it("does not emit on refresh$ when dialog is cancelled", async () => {
      const col = { canEdit: jest.fn().mockReturnValue(true) } as unknown as CollectionView;
      jest
        .spyOn(BulkCollectionsDialogComponent, "open")
        .mockReturnValue(makeDialogRef(undefined) as any);

      await service.bulkEditCollectionAccess([col], organization);

      expect(refreshEmitted).toBe(false);
    });
  });

  describe("sync listener", () => {
    it("emits on refresh$ when a successful syncCompleted message is received", () => {
      messageSubject.next({ command: "syncCompleted", successfully: true });

      expect(refreshEmitted).toBe(true);
    });

    it("does not emit on refresh$ when syncCompleted has successfully=false", () => {
      messageSubject.next({ command: "syncCompleted", successfully: false });

      expect(refreshEmitted).toBe(false);
    });

    it("does not emit on refresh$ for unrelated commands", () => {
      messageSubject.next({ command: "loggedIn" });

      expect(refreshEmitted).toBe(false);
    });
  });
});
