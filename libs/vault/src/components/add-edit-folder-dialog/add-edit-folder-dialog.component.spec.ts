import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { BehaviorSubject } from "rxjs";

import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogData,
  AddEditFolderDialogResult,
} from "./add-edit-folder-dialog.component";

describe("AddEditFolderDialogComponent", () => {
  let component: AddEditFolderDialogComponent;
  let fixture: ComponentFixture<AddEditFolderDialogComponent>;

  const dialogData = {} as AddEditFolderDialogData;
  const folder = new Folder();
  const encrypt = jest.fn().mockResolvedValue(folder);
  const save = jest.fn().mockResolvedValue(null);
  const deleteFolder = jest.fn().mockResolvedValue(null);
  const openSimpleDialog = jest.fn().mockResolvedValue(true);
  const getUserKey = jest.fn().mockResolvedValue("");
  const error = jest.fn();
  const close = jest.fn();
  const showToast = jest.fn();

  const dialogRef = {
    close,
  };

  beforeEach(async () => {
    encrypt.mockClear();
    save.mockClear();
    deleteFolder.mockClear();
    error.mockClear();
    close.mockClear();
    showToast.mockClear();

    const userId = "" as UserId;
    const accountInfo: AccountInfo = {
      email: "",
      emailVerified: true,
      name: undefined,
    };

    await TestBed.configureTestingModule({
      imports: [AddEditFolderDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: FolderService, useValue: { encrypt } },
        { provide: FolderApiServiceAbstraction, useValue: { save, delete: deleteFolder } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: userId, ...accountInfo }) },
        },
        {
          provide: KeyService,
          useValue: {
            getUserKey,
          },
        },
        { provide: LogService, useValue: { error } },
        { provide: ToastService, useValue: { showToast } },
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: DialogRef, useValue: dialogRef },
      ],
    })
      .overrideProvider(DialogService, { useValue: { openSimpleDialog } })
      .compileComponents();

    fixture = TestBed.createComponent(AddEditFolderDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("new folder", () => {
    it("requires a folder name", async () => {
      await component.submit();

      expect(encrypt).not.toHaveBeenCalled();

      component.folderForm.controls.name.setValue("New Folder");

      await component.submit();

      expect(encrypt).toHaveBeenCalled();
    });

    it("submits a new folder view", async () => {
      component.folderForm.controls.name.setValue("New Folder");

      await component.submit();

      const newFolder = new FolderView();
      newFolder.name = "New Folder";

      expect(encrypt).toHaveBeenCalledWith(newFolder, "");
      expect(save).toHaveBeenCalled();
    });

    it("shows success toast after saving", async () => {
      component.folderForm.controls.name.setValue("New Folder");

      await component.submit();

      expect(showToast).toHaveBeenCalledWith({
        message: "editedFolder",
        title: "",
        variant: "success",
      });
    });

    it("closes the dialog after saving", async () => {
      component.folderForm.controls.name.setValue("New Folder");

      await component.submit();

      expect(close).toHaveBeenCalledWith(AddEditFolderDialogResult.Created);
    });

    it("logs error if saving fails", async () => {
      const errorObj = new Error("Failed to save folder");
      save.mockRejectedValue(errorObj);

      component.folderForm.controls.name.setValue("New Folder");

      await component.submit();

      expect(error).toHaveBeenCalledWith(errorObj);
    });
  });

  describe("editing folder", () => {
    const folderView = new FolderView();
    folderView.id = "1";
    folderView.name = "Folder 1";

    beforeEach(() => {
      dialogData.editFolderConfig = { folder: folderView };

      component.ngOnInit();
    });

    it("populates form with folder name", () => {
      expect(component.folderForm.controls.name.value).toBe("Folder 1");
    });

    it("submits the updated folder", async () => {
      component.folderForm.controls.name.setValue("Edited Folder");
      await component.submit();

      expect(encrypt).toHaveBeenCalledWith(
        {
          ...dialogData.editFolderConfig!.folder,
          name: "Edited Folder",
        },
        "",
      );
    });

    it("deletes the folder", async () => {
      await component.deleteFolder();

      expect(deleteFolder).toHaveBeenCalledWith(folderView.id, "");
      expect(showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: "deletedFolder",
      });
      expect(close).toHaveBeenCalledWith(AddEditFolderDialogResult.Deleted);
    });
  });
});
