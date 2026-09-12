import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, map, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { AddEditFolderDialogComponent } from "../add-edit-folder-dialog/add-edit-folder-dialog.component";
import { openDeleteFolderDialog } from "../delete-folder-dialog/delete-folder-dialog.component";

import { MyFoldersComponent } from "./my-folders.component";

jest.mock("../delete-folder-dialog/delete-folder-dialog.component", () => ({
  ...jest.requireActual("../delete-folder-dialog/delete-folder-dialog.component"),
  openDeleteFolderDialog: jest.fn(),
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const folder = (id: string, name: string): FolderView =>
  Object.assign(new FolderView(), { id, name });

let nextCipherId = 0;
const cipher = (folderId: string | undefined, overrides: Partial<CipherView> = {}): CipherView =>
  Object.assign(new CipherView(), { id: `cipher-${nextCipherId++}`, folderId }, overrides);

describe("MyFoldersComponent", () => {
  const userId = "user-id" as UserId;
  const folderViews$ = new BehaviorSubject<FolderView[]>([]);
  const cipherListViews$ = new BehaviorSubject<CipherView[]>([]);

  const folderApiService = mock<FolderApiServiceAbstraction>();
  const folderService = mock<FolderService>();
  const dialogService = mock<DialogService>();
  const toastService = mock<ToastService>();

  let fixture: ComponentFixture<MyFoldersComponent>;
  let component: MyFoldersComponent;
  let openDeleteDialog: jest.Mock;

  /** Selects by folder name — the table owns the checkboxes, so they carry no per-row id. */
  const selectRow = (name: string) => {
    const row = fixture.debugElement
      .queryAll(By.css("bit-row"))
      .find((r) => r.queryAll(By.css("[role=cell]"))[1].nativeElement.textContent.trim() === name);
    row!.query(By.css("input[type=checkbox]")).nativeElement.dispatchEvent(new Event("change"));
    fixture.detectChanges();
  };

  const checkedRows = () =>
    fixture.debugElement
      .queryAll(By.css("bit-row input[type=checkbox]"))
      .map((box) => box.nativeElement.checked);

  const selectAll = () => {
    fixture.debugElement
      .query(By.css("[role=columnheader] input[type=checkbox]"))
      .nativeElement.dispatchEvent(new Event("change"));
    fixture.detectChanges();
  };

  /** Edit and delete are icon buttons in the row, per the design — not a menu. */
  const clickRowAction = async (id: string, action: "edit" | "delete") => {
    fixture.debugElement
      .query(By.css(`#my-folders_button_${action}-${id}`))
      .nativeElement.dispatchEvent(new MouseEvent("click"));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    folderViews$.next([folder("1", "Travel"), folder("2", "Banking"), folder("3", "Work")]);
    cipherListViews$.next([cipher("1"), cipher("2"), cipher("2"), cipher("2")]);

    folderService.folderViews$.mockReturnValue(folderViews$);
    folderService.getDecrypted$.mockImplementation((id) =>
      folderViews$.pipe(map((folders) => folders.find((f) => f.id === id))),
    );
    folderApiService.delete.mockResolvedValue(undefined);
    openDeleteDialog = openDeleteFolderDialog as jest.Mock;
    openDeleteDialog.mockReset();
    openDeleteDialog.mockReturnValue({ closed: of(true) } as never);
    folderApiService.deleteMany.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [MyFoldersComponent, NoopAnimationsModule],
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: CipherService, useValue: { cipherListViews$: () => cipherListViews$ } },
        { provide: DialogService, useValue: dialogService },
        { provide: FolderApiServiceAbstraction, useValue: folderApiService },
        { provide: FolderService, useValue: folderService },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ").trim() },
        },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyFoldersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("add and edit", () => {
    let open: jest.SpyInstance;

    beforeEach(() => {
      open = jest
        .spyOn(AddEditFolderDialogComponent, "open")
        .mockReturnValue({ closed: new BehaviorSubject(undefined) } as never);
    });

    it("opens the dialog with no folder from the add button", async () => {
      fixture.debugElement
        .query(By.css("#my-folders_button_add-folder"))
        .triggerEventHandler("click");
      await fixture.whenStable();

      expect(open).toHaveBeenCalledWith(dialogService);
    });

    it("opens the dialog with the row's folder from the edit action", async () => {
      await clickRowAction("2", "edit");

      expect(open).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          editFolderConfig: {
            folder: expect.objectContaining({ id: "2", name: "Banking" }),
          },
          hideDelete: true,
        }),
      );
    });
  });

  describe("delete", () => {
    it("confirms with the folder name, deletes and shows the deleted toast", async () => {
      await clickRowAction("2", "delete");

      expect(openDeleteDialog).toHaveBeenCalledWith(dialogService, { folderName: "Banking" });
      expect(folderApiService.delete).toHaveBeenCalledWith("2", userId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "deletedFolder",
      });
    });

    it("does not delete when the confirmation is cancelled", async () => {
      openDeleteDialog.mockReturnValue({ closed: of(false) } as never);

      await clickRowAction("2", "delete");

      expect(folderApiService.delete).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("shows an error toast when a delete fails", async () => {
      folderApiService.delete.mockRejectedValue(new Error("boom"));

      await clickRowAction("2", "delete");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "errorOccurred",
      });
    });
  });

  describe("bulk delete", () => {
    it("confirms with the pluralised copy, deletes each folder and shows the plural toast", async () => {
      selectAll();

      await component["deleteSelected"]();

      expect(openDeleteDialog).toHaveBeenCalledWith(dialogService, { count: 3 });
      expect(folderApiService.deleteMany).toHaveBeenCalledWith(["1", "2", "3"], userId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "foldersDeleted",
      });
    });

    it("uses the single-folder copy and toast when only one row is selected", async () => {
      selectRow("Banking");

      await component["deleteSelected"]();

      expect(openDeleteDialog).toHaveBeenCalledWith(dialogService, { folderName: "Banking" });
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "deletedFolder",
      });
    });

    it("keeps a selected row checked after it is renamed", () => {
      selectRow("Banking");
      expect(checkedRows()).toEqual([true, false, false]);

      folderViews$.next([folder("1", "Travel"), folder("2", "Bank"), folder("3", "Work")]);
      fixture.detectChanges();

      expect(checkedRows()).toEqual([true, false, false]);
      expect(component["selected"]().map((row) => row.displayName)).toEqual(["Bank"]);
    });

    it("drops a selected row that disappears from the data", () => {
      selectAll();

      folderViews$.next([folder("1", "Travel")]);
      fixture.detectChanges();

      expect(component["selected"]().map((row) => row.id)).toEqual(["1"]);
    });

    it("keeps rows checked when the ciphers re-emit", () => {
      selectAll();
      expect(checkedRows()).toEqual([true, true, true]);

      cipherListViews$.next([cipher("1"), cipher("2"), cipher("2"), cipher("2")]);
      fixture.detectChanges();

      expect(checkedRows()).toEqual([true, true, true]);
    });

    it("clears the selection once the deleted folders leave the data", async () => {
      selectAll();

      await component["deleteSelected"]();
      // Deleting updates folder state, which is what drives the selection reconciliation.
      folderViews$.next([]);
      fixture.detectChanges();

      expect(component["selected"]()).toEqual([]);
    });
  });
});
