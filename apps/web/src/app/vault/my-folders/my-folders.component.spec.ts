import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, map } from "rxjs";

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
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";

import { buildFolderRows, MyFoldersComponent } from "./my-folders.component";

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

@Component({
  selector: "app-header",
  template: "<ng-content></ng-content>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHeaderComponent {}

const folder = (id: string, name: string): FolderView =>
  Object.assign(new FolderView(), { id, name });

let nextCipherId = 0;
const cipher = (folderId: string | undefined, overrides: Partial<CipherView> = {}): CipherView =>
  Object.assign(new CipherView(), { id: `cipher-${nextCipherId++}`, folderId }, overrides);

describe("buildFolderRows", () => {
  it("counts the ciphers each folder is applied to", () => {
    const rows = buildFolderRows(
      [folder("1", "Banking"), folder("2", "Travel")],
      [cipher("1"), cipher("1"), cipher("2"), cipher(undefined)],
    );

    expect(rows).toEqual([
      { id: "1", name: "Banking", displayName: "Banking", itemCount: 2 },
      { id: "2", name: "Travel", displayName: "Travel", itemCount: 1 },
    ]);
  });

  it("excludes trashed ciphers from the count but keeps archived ones", () => {
    const rows = buildFolderRows(
      [folder("1", "Banking")],
      [
        cipher("1"),
        cipher("1", { deletedDate: new Date() }),
        cipher("1", { archivedDate: new Date() }),
      ],
    );

    expect(rows[0].itemCount).toBe(2);
  });

  it("excludes the synthetic no-folder entry", () => {
    const rows = buildFolderRows([folder("1", "Banking"), new FolderView()], []);

    expect(rows.map((row) => row.id)).toEqual(["1"]);
  });

  it("shows an em-dash when the folder has no name", () => {
    const rows = buildFolderRows([folder("1", "   ")], []);

    expect(rows[0].displayName).toBe("—");
  });
});

describe("MyFoldersComponent", () => {
  const userId = "user-id" as UserId;
  const folderViews$ = new BehaviorSubject<FolderView[]>([]);
  const cipherViews$ = new BehaviorSubject<CipherView[]>([]);

  const folderApiService = mock<FolderApiServiceAbstraction>();
  const folderService = mock<FolderService>();
  const dialogService = mock<DialogService>();
  const toastService = mock<ToastService>();

  let fixture: ComponentFixture<MyFoldersComponent>;
  let component: MyFoldersComponent;

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
    cipherViews$.next([cipher("1"), cipher("2"), cipher("2"), cipher("2")]);

    folderService.folderViews$.mockReturnValue(folderViews$);
    folderService.getDecrypted$.mockImplementation((id) =>
      folderViews$.pipe(map((folders) => folders.find((f) => f.id === id))),
    );
    folderApiService.delete.mockResolvedValue(undefined);
    folderApiService.deleteMany.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [MyFoldersComponent, NoopAnimationsModule],
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: CipherService, useValue: { cipherViews$: () => cipherViews$ } },
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
    })
      .overrideComponent(MyFoldersComponent, {
        remove: { imports: [HeaderModule] },
        add: { imports: [MockHeaderComponent] },
      })
      .compileComponents();

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
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await clickRowAction("2", "delete");

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "deleteFolder" },
        content: { key: "deleteFolderDescription", placeholders: ["Banking"] },
        acceptButtonText: { key: "delete" },
        cancelButtonText: { key: "cancel" },
        type: "danger",
      });
      expect(folderApiService.delete).toHaveBeenCalledWith("2", userId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "deletedFolder",
      });
    });

    it("does not delete when the confirmation is cancelled", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await clickRowAction("2", "delete");

      expect(folderApiService.delete).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("shows an error toast when a delete fails", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
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
      dialogService.openSimpleDialog.mockResolvedValue(true);
      selectAll();

      await component["deleteSelected"]();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "deleteFoldersCount", placeholders: [3] },
        content: { key: "deleteFoldersDescription" },
        acceptButtonText: { key: "delete" },
        cancelButtonText: { key: "cancel" },
        type: "danger",
      });
      expect(folderApiService.deleteMany).toHaveBeenCalledWith(["1", "2", "3"], userId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "foldersDeleted",
      });
    });

    it("uses the single-folder copy and toast when only one row is selected", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      selectRow("Banking");

      await component["deleteSelected"]();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "deleteFolder" },
          content: { key: "deleteFolderDescription", placeholders: ["Banking"] },
        }),
      );
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

      cipherViews$.next([cipher("1"), cipher("2"), cipher("2"), cipher("2")]);
      fixture.detectChanges();

      expect(checkedRows()).toEqual([true, true, true]);
    });

    it("clears the selection once the deleted folders leave the data", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      selectAll();

      await component["deleteSelected"]();
      // Deleting updates folder state, which is what drives the selection reconciliation.
      folderViews$.next([]);
      fixture.detectChanges();

      expect(component["selected"]()).toEqual([]);
    });
  });
});
