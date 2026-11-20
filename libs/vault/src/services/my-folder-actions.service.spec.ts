import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { AddEditFolderDialogComponent } from "../components/add-edit-folder-dialog/add-edit-folder-dialog.component";
import { openDeleteFolderDialog } from "../components/delete-folder-dialog/delete-folder-dialog.component";

import { MyFolderActionsService } from "./my-folder-actions.service";

jest.mock("../components/delete-folder-dialog/delete-folder-dialog.component", () => ({
  ...jest.requireActual("../components/delete-folder-dialog/delete-folder-dialog.component"),
  openDeleteFolderDialog: jest.fn(),
}));

describe("MyFolderActionsService", () => {
  const userId = "user-id" as UserId;
  const folder = Object.assign(new FolderView(), { id: "folder-1", name: "Family/Kids" });

  const folderApiService = mock<FolderApiServiceAbstraction>();
  const folderService = mock<FolderService>();
  const dialogService = mock<DialogService>();
  const toastService = mock<ToastService>();
  const logService = mock<LogService>();

  let service: MyFolderActionsService;
  let openAddEditDialog: jest.SpyInstance;
  let openDeleteDialog: jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();

    folderService.getDecrypted$.mockReturnValue(of(folder));
    folderApiService.delete.mockResolvedValue(undefined);
    folderApiService.deleteMany.mockResolvedValue(undefined);

    openAddEditDialog = jest
      .spyOn(AddEditFolderDialogComponent, "open")
      .mockReturnValue({ closed: of(undefined) } as any);
    openDeleteDialog = openDeleteFolderDialog as jest.Mock;
    openDeleteDialog.mockReturnValue({ closed: of(true) });

    TestBed.configureTestingModule({
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: DialogService, useValue: dialogService },
        { provide: FolderApiServiceAbstraction, useValue: folderApiService },
        { provide: FolderService, useValue: folderService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: logService },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(MyFolderActionsService);
  });

  afterEach(() => {
    openAddEditDialog.mockRestore();
  });

  describe("edit", () => {
    it("opens the edit dialog with a copy of the folder, without its own delete", async () => {
      await service.edit("folder-1");

      expect(folderService.getDecrypted$).toHaveBeenCalledWith("folder-1", userId);
      expect(openAddEditDialog).toHaveBeenCalledWith(dialogService, {
        editFolderConfig: { folder: { ...folder } },
        hideDelete: true,
      });
    });

    it("opens nothing for a folder the user does not hold", async () => {
      folderService.getDecrypted$.mockReturnValue(of(null));

      await service.edit("missing");

      expect(openAddEditDialog).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("confirms with the folder's name, deletes it and shows the deleted toast", async () => {
      const deleted = await service.delete({ id: "folder-1", displayName: "Kids" });

      expect(openDeleteDialog).toHaveBeenCalledWith(dialogService, { folderName: "Kids" });
      expect(folderApiService.delete).toHaveBeenCalledWith("folder-1", userId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "deletedFolder",
      });
      expect(deleted).toBe(true);
    });

    it("deletes nothing when the confirmation is cancelled", async () => {
      openDeleteDialog.mockReturnValue({ closed: of(false) });

      const deleted = await service.delete({ id: "folder-1", displayName: "Kids" });

      expect(folderApiService.delete).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(deleted).toBe(false);
    });

    it("shows an error toast and reports no delete when the request fails", async () => {
      folderApiService.delete.mockRejectedValue(new Error("boom"));

      const deleted = await service.delete({ id: "folder-1", displayName: "Kids" });

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "errorOccurred",
      });
      expect(deleted).toBe(false);
    });
  });

  describe("deleteFolders", () => {
    it("deletes several folders at once and shows the given toast", async () => {
      const deleted = await service.deleteFolders(["a", "b"], "foldersDeleted");

      expect(folderApiService.deleteMany).toHaveBeenCalledWith(["a", "b"], userId);
      expect(folderApiService.delete).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "foldersDeleted",
      });
      expect(deleted).toBe(true);
    });
  });
});
