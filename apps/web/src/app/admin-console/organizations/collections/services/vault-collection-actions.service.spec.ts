// jest.mock is hoisted before imports, allowing openCollectionDialog to be intercepted.
jest.mock("../../shared/components/collection-dialog", () => ({
  ...jest.requireActual("../../shared/components/collection-dialog"),
  openCollectionDialog: jest.fn(),
}));

import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  CollectionAdminView,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  CollectionDialogAction,
  CollectionDialogTabType,
  openCollectionDialog,
} from "../../shared/components/collection-dialog";
import {
  BulkCollectionsDialogComponent,
  BulkCollectionsDialogResult,
} from "../bulk-collections-dialog";

import { VaultCollectionActionsService } from "./vault-collection-actions.service";

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

  let organization: Organization;
  let refresh: jest.Mock;

  function initService(
    selectedCollection: TreeNode<CollectionAdminView> | undefined = undefined,
    org = organization,
  ) {
    service.init(
      of(org),
      of(USER_ID),
      of(selectedCollection),
      of([] as CollectionAdminView[]),
      refresh,
    );
  }

  beforeEach(() => {
    apiService = mock<ApiService>();
    collectionService = mock<CollectionService>();
    cipherService = mock<CipherService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    i18nService = mock<I18nService>();
    router = mock<Router>();

    i18nService.t.mockReturnValue("translated");
    apiService.deleteCollection.mockResolvedValue(undefined);
    collectionService.delete.mockResolvedValue(undefined);
    cipherService.clear.mockResolvedValue(undefined);

    organization = buildOrg();
    refresh = jest.fn();

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
      ],
    });

    service = TestBed.inject(VaultCollectionActionsService);
    initService();
  });

  describe("addCollection", () => {
    it("opens the collection dialog with organization and parent collection params", async () => {
      const parent = buildCollection({ id: "parent-col" as CollectionId });
      const parentNode = buildTreeNode(parent);
      initService(parentNode);

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

    it("calls refresh when dialog action is Saved", async () => {
      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Saved }));

      await service.addCollection();

      expect(refresh).toHaveBeenCalled();
    });

    it("calls refresh when dialog action is Deleted", async () => {
      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Deleted }));

      await service.addCollection();

      expect(refresh).toHaveBeenCalled();
    });

    it("does not call refresh when dialog is cancelled", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(makeDialogRef(undefined));

      await service.addCollection();

      expect(refresh).not.toHaveBeenCalled();
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

    it("calls refresh when dialog action is Saved", async () => {
      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Saved }));

      await service.editCollection(buildCollection(), CollectionDialogTabType.Info, false);

      expect(refresh).toHaveBeenCalled();
    });

    it("calls refresh when dialog action is Deleted", async () => {
      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Deleted }));

      await service.editCollection(buildCollection(), CollectionDialogTabType.Info, false);

      expect(refresh).toHaveBeenCalled();
    });

    it("navigates away when the deleted collection was the currently selected one", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const parentCol = buildCollection({ id: "parent-col" as CollectionId });
      const parentNode = buildTreeNode(parentCol);
      const selectedNode = buildTreeNode(collection, parentNode);
      initService(selectedNode);

      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Deleted }));

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
      const selectedNode = buildTreeNode(otherCollection);
      initService(selectedNode);

      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Deleted }));

      await service.editCollection(collection, CollectionDialogTabType.Info, false);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does not navigate when the dialog action is Saved (not Deleted)", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const selectedNode = buildTreeNode(collection);
      initService(selectedNode);

      jest
        .mocked(openCollectionDialog)
        .mockReturnValue(makeDialogRef({ action: CollectionDialogAction.Saved }));

      await service.editCollection(collection, CollectionDialogTabType.Info, false);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("does not call refresh when dialog is cancelled", async () => {
      jest.mocked(openCollectionDialog).mockReturnValue(makeDialogRef(undefined));

      await service.editCollection(buildCollection(), CollectionDialogTabType.Info, false);

      expect(refresh).not.toHaveBeenCalled();
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

    it("calls refresh after successful deletion", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(refresh).toHaveBeenCalled();
    });

    it("navigates away when the deleted collection is the currently viewed one", async () => {
      const collection = buildCollection({ id: "target-col" as CollectionId });
      const parentCol = buildCollection({ id: "parent-col" as CollectionId });
      const parentNode = buildTreeNode(parentCol);
      const selectedNode = buildTreeNode(collection, parentNode);
      initService(selectedNode);
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
      initService(buildTreeNode(otherCol));
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.deleteCollection(collection);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("logs an error and does not refresh when deletion throws", async () => {
      const collection = buildCollection();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      apiService.deleteCollection.mockRejectedValue(new Error("server error"));

      await service.deleteCollection(collection);

      expect(logService.error).toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
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

    it("calls refresh when dialog result is Saved", async () => {
      const col = { canEdit: jest.fn().mockReturnValue(true) } as unknown as CollectionView;
      jest
        .spyOn(BulkCollectionsDialogComponent, "open")
        .mockReturnValue(makeDialogRef(BulkCollectionsDialogResult.Saved) as any);

      await service.bulkEditCollectionAccess([col], organization);

      expect(refresh).toHaveBeenCalled();
    });

    it("does not call refresh when dialog is cancelled", async () => {
      const col = { canEdit: jest.fn().mockReturnValue(true) } as unknown as CollectionView;
      jest
        .spyOn(BulkCollectionsDialogComponent, "open")
        .mockReturnValue(makeDialogRef(undefined) as any);

      await service.bulkEditCollectionAccess([col], organization);

      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
