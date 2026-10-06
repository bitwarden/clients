import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { BulkDeleteService } from "@bitwarden/vault";

import { BulkDeleteDialogDesktopAdapter } from "./bulk-delete-dialog-desktop.adapter";

describe("BulkDeleteDialogDesktopAdapter", () => {
  let adapter: BulkDeleteDialogDesktopAdapter;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;

  const collection = (id: string) =>
    new CollectionView({
      id: id as CollectionId,
      organizationId: "org-1" as OrganizationId,
      name: `Collection ${id}`,
    });

  const setup = (vfo1Enabled: boolean) => {
    TestBed.resetTestingModule();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    dialogService.openSimpleDialog.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        BulkDeleteDialogDesktopAdapter,
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: BulkDeleteService, useValue: mock<BulkDeleteService>() },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(vfo1Enabled) } },
      ],
    });

    adapter = TestBed.inject(BulkDeleteDialogDesktopAdapter);
  };

  const dialogOptions = () => dialogService.openSimpleDialog.mock.calls[0][0];
  const toastMessages = () => toastService.showToast.mock.calls.map(([toast]) => toast.message);

  describe("deleting shared folders only", () => {
    it.each([
      [1, "deleteCollection", "deleteCollectionDesc", "collectionDeleted"],
      [2, "deleteCollectionsCount", "deleteCollectionsDesc", "collectionsDeleted"],
    ])(
      "uses collection terminology for %i when the vfo1 flag is off",
      async (count, title, content, toast) => {
        setup(false);

        await adapter.open({
          collections: Array.from({ length: count }, (_, i) => collection(`c-${i}`)),
        });

        expect(dialogOptions().title).toMatchObject({ key: title });
        expect(dialogOptions().content).toMatchObject({ key: content });
        expect(toastMessages()).toEqual([toast]);
      },
    );

    it.each([
      [1, "deleteSharedFolder", "deleteSharedFolderKeepItemsDesc", "sharedFolderDeleted"],
      [2, "deleteSharedFoldersCount", "deleteSharedFoldersKeepItemsDesc", "sharedFoldersDeleted"],
    ])(
      "uses shared folder terminology for %i when the vfo1 flag is on",
      async (count, title, content, toast) => {
        setup(true);

        await adapter.open({
          collections: Array.from({ length: count }, (_, i) => collection(`c-${i}`)),
        });

        expect(dialogOptions().title).toMatchObject({ key: title });
        expect(dialogOptions().content).toMatchObject({ key: content });
        expect(toastMessages()).toEqual([toast]);
      },
    );

    it("keeps the count placeholder when the vfo1 flag is on", async () => {
      setup(true);

      await adapter.open({ collections: [collection("c-0"), collection("c-1")] });

      expect(dialogOptions().title).toEqual({
        key: "deleteSharedFoldersCount",
        placeholders: [2],
      });
    });
  });

  describe("deleting items and shared folders together", () => {
    const openMixed = () =>
      adapter.open({ cipherIds: ["cipher-1" as CipherId], collections: [collection("c-0")] });

    it("uses collection terminology when the vfo1 flag is off", async () => {
      setup(false);

      await openMixed();

      expect(dialogOptions().content).toMatchObject({ key: "deleteItemsAndCollectionsDesc" });
      expect(toastMessages()).toContain("collectionDeleted");
    });

    it("uses shared folder terminology when the vfo1 flag is on", async () => {
      setup(true);

      await openMixed();

      expect(dialogOptions().content).toMatchObject({ key: "deleteItemsAndSharedFoldersDesc" });
      expect(toastMessages()).toContain("sharedFolderDeleted");
    });
  });

  describe("deleting items only", () => {
    it("is unaffected by the vfo1 flag", async () => {
      setup(true);

      await adapter.open({ cipherIds: ["cipher-1" as CipherId] });

      expect(dialogOptions().title).toMatchObject({ key: "deleteItem" });
      expect(toastMessages()).toEqual(["deletedItem"]);
    });
  });
});
