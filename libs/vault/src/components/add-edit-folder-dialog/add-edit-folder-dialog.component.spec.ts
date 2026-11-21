import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
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
  const userKey$ = jest.fn().mockReturnValue(of(""));
  const error = jest.fn();
  const close = jest.fn();
  const showToast = jest.fn();

  const dialogRef = {
    close,
  };

  let vfo1Enabled$: BehaviorSubject<boolean>;
  let folders$: BehaviorSubject<FolderView[]>;
  let showCallout$: BehaviorSubject<boolean>;
  const nudgesService = mock<NudgesService>();

  const buildFolder = (id: string | null, name: string) =>
    Object.assign(new FolderView(), { id, name });

  beforeEach(async () => {
    vfo1Enabled$ = new BehaviorSubject<boolean>(false);
    // Shared across specs; the edit variant sets it and would otherwise leak into later tests.
    delete dialogData.editFolderConfig;
    delete dialogData.parentFolderId;
    folders$ = new BehaviorSubject<FolderView[]>([]);
    showCallout$ = new BehaviorSubject<boolean>(false);
    nudgesService.showNudgeSpotlight$.mockReturnValue(showCallout$);
    nudgesService.dismissNudge.mockClear();
    encrypt.mockClear();
    save.mockClear();
    deleteFolder.mockClear();
    error.mockClear();
    close.mockClear();
    showToast.mockClear();

    const userId = "" as UserId;
    const accountInfo = mockAccountInfoWith();

    await TestBed.configureTestingModule({
      imports: [AddEditFolderDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: FolderService, useValue: { encrypt, folderViews$: () => folders$ } },
        { provide: NudgesService, useValue: nudgesService },
        { provide: FolderApiServiceAbstraction, useValue: { save, delete: deleteFolder } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: userId, ...accountInfo }) },
        },
        {
          provide: KeyService,
          useValue: {
            userKey$,
          },
        },
        { provide: LogService, useValue: { error } },
        { provide: ToastService, useValue: { showToast } },
        { provide: DIALOG_DATA, useValue: dialogData },
        { provide: DialogRef, useValue: dialogRef },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => vfo1Enabled$ } },
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

      expect(encrypt).toHaveBeenCalledWith(expect.objectContaining({ name: "New Folder" }), "");
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

    beforeEach(async () => {
      dialogData.editFolderConfig = { folder: folderView };

      await component.ngOnInit();
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

  describe("VFO1 name rules", () => {
    it("applies the new rules when the flag resolves after construction", async () => {
      vfo1Enabled$.next(true);
      fixture.detectChanges();

      await component.submit();

      const errors = component.folderForm.controls.name.errors ?? {};
      // `bit-error` renders `Object.keys(errors)[0]`, so the VFO1 error has to win over the
      // native `required` the input's attribute also registers.
      expect(Object.keys(errors)[0]).toBe("folderNameRequired");
      expect(errors.folderNameRequired).toEqual({ message: "enterAName" });
      expect(encrypt).not.toHaveBeenCalled();
    });
  });

  describe("VFO1 nesting", () => {
    /** Builds a fresh dialog so the dialog data and flag are in place before it initializes. */
    const createWithVfo1 = async () => {
      vfo1Enabled$.next(true);
      fixture = TestBed.createComponent(AddEditFolderDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await component.ngOnInit();
      fixture.detectChanges();
    };

    const parentOptions = () => component["parentOptions"]();

    beforeEach(() => {
      folders$.next([
        buildFolder(null, "No folder"),
        buildFolder("family", "Family"),
        buildFolder("house", "Family/House"),
        buildFolder("garage", "Family/House/Garage"),
        buildFolder("work", "/Work/"),
      ]);
    });

    describe("adding a folder", () => {
      it("offers every folder path, sorted, without the no-folder entry", async () => {
        await createWithVfo1();

        expect(parentOptions()).toEqual(["Family", "Family/House", "Family/House/Garage", "Work"]);
      });

      it("prefills the parent from the folder it was opened from", async () => {
        dialogData.parentFolderId = "house";

        await createWithVfo1();

        expect(component.folderForm.controls.parent.value).toBe("Family/House");
      });

      it("leaves the parent empty when the given folder does not exist", async () => {
        dialogData.parentFolderId = "missing";

        await createWithVfo1();

        expect(component.folderForm.controls.parent.value).toBeNull();
      });

      it("saves the name nested under the selected parent", async () => {
        await createWithVfo1();
        component.folderForm.patchValue({ name: " Kids ", parent: "Family" });

        await component.submit();

        expect(encrypt).toHaveBeenCalledWith(expect.objectContaining({ name: "Family/Kids" }), "");
      });

      it("saves a top-level folder when no parent is selected", async () => {
        await createWithVfo1();
        component.folderForm.patchValue({ name: "Kids" });

        await component.submit();

        expect(encrypt).toHaveBeenCalledWith(expect.objectContaining({ name: "Kids" }), "");
      });

      it("rejects a slash in the name", async () => {
        await createWithVfo1();
        component.folderForm.controls.name.setValue("Family/Kids");

        await component.submit();

        expect(component.folderForm.controls.name.errors).toEqual({
          folderNameSlashNotAllowed: { message: "folderNameSlashNotAllowed" },
        });
        expect(encrypt).not.toHaveBeenCalled();
      });
    });

    describe("editing a nested folder", () => {
      beforeEach(() => {
        dialogData.editFolderConfig = { folder: buildFolder("house", "Family/House") };
      });

      it("splits the stored name across the name field and the parent select", async () => {
        await createWithVfo1();

        expect(component.folderForm.controls.name.value).toBe("House");
        expect(component.folderForm.controls.parent.value).toBe("Family");
      });

      it("does not offer the folder itself or anything nested under it", async () => {
        await createWithVfo1();

        expect(parentOptions()).toEqual(["Family", "Work"]);
      });

      it("shows a parent that no folder holds as deleted rather than as an option", async () => {
        dialogData.editFolderConfig = { folder: buildFolder("kids", "Relatives/Kids") };

        await createWithVfo1();

        expect(component["deletedParent"]()).toBe("Relatives");
        expect(parentOptions()).not.toContain("Relatives");
        expect(component.folderForm.controls.parent.value).toBe("Relatives");
      });

      it("keeps the deleted parent when saving without changes", async () => {
        dialogData.editFolderConfig = { folder: buildFolder("kids", "Relatives/Kids") };
        await createWithVfo1();

        await component.submit();

        expect(encrypt).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Relatives/Kids" }),
          "",
        );
      });

      it("has no deleted parent when the parent folder exists", async () => {
        await createWithVfo1();

        expect(component["deletedParent"]()).toBeUndefined();
      });

      it("saves the stored name unchanged when nothing was edited", async () => {
        await createWithVfo1();

        await component.submit();

        expect(encrypt).toHaveBeenCalledWith(
          expect.objectContaining({ id: "house", name: "Family/House" }),
          "",
        );
      });

      it("moves the folder when a different parent is selected", async () => {
        await createWithVfo1();
        component.folderForm.controls.parent.setValue("Work");

        await component.submit();

        expect(encrypt).toHaveBeenCalledWith(expect.objectContaining({ name: "Work/House" }), "");
      });
    });

    describe("nesting callout", () => {
      it("shows while the nudge is pending", async () => {
        showCallout$.next(true);

        await createWithVfo1();

        expect(component["showNestingCallout"]()).toBe(true);
        expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
          NudgeType.Vfo1FolderNestingCallout,
          "",
        );
      });

      it("stays hidden once the nudge is dismissed", async () => {
        await createWithVfo1();

        expect(component["showNestingCallout"]()).toBe(false);
      });

      it("never shows without VFO1", () => {
        showCallout$.next(true);

        expect(component["showNestingCallout"]()).toBe(false);
      });

      it("dismisses the nudge from the close button", async () => {
        showCallout$.next(true);
        await createWithVfo1();

        await component["dismissNestingCallout"]();

        expect(nudgesService.dismissNudge).toHaveBeenCalledWith(
          NudgeType.Vfo1FolderNestingCallout,
          "",
        );
      });
    });

    it("does not nest when VFO1 is off", async () => {
      dialogData.editFolderConfig = { folder: buildFolder("house", "Family/House") };

      await component.ngOnInit();

      expect(component.folderForm.controls.name.value).toBe("Family/House");
      expect(component.folderForm.controls.parent.value).toBeNull();
    });
  });
});
