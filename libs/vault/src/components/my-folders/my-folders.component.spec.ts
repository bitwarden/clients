import { PortalModule } from "@angular/cdk/portal";
import { CdkVirtualScrollViewport } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
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
import { DialogService, LayoutFooterService, ToastService } from "@bitwarden/components";

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

/** Stands in for the layout's footer region, where the component renders its bulk actions bar. */
@Component({
  selector: "test-footer-outlet",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PortalModule],
  template: `<ng-template [cdkPortalOutlet]="footerPortal()"></ng-template>`,
})
class FooterOutletComponent {
  protected readonly footerPortal = inject(LayoutFooterService).portal;
}

describe("MyFoldersComponent", () => {
  const userId = "user-id" as UserId;
  const folderViews$ = new BehaviorSubject<FolderView[]>([]);
  const cipherListViews$ = new BehaviorSubject<CipherView[]>([]);

  const folderApiService = mock<FolderApiServiceAbstraction>();
  const folderService = mock<FolderService>();
  const dialogService = mock<DialogService>();
  const toastService = mock<ToastService>();

  let fixture: ComponentFixture<MyFoldersComponent>;
  let footerFixture: ComponentFixture<FooterOutletComponent>;
  let component: MyFoldersComponent;
  let openDeleteDialog: jest.Mock;

  // CDK's CdkVirtualScrollViewport.ngOnInit() defers initialization in a Promise.resolve().then(),
  // which never resolves during synchronous fixture.detectChanges() calls in JSDOM. Patch it to
  // run synchronously so the scroll strategy attaches and sets the rendered range before
  // CdkVirtualForOf.ngDoCheck() runs, allowing rows to appear in the same detectChanges() call.
  const originalNgOnInit = CdkVirtualScrollViewport.prototype.ngOnInit;
  beforeAll(() => {
    CdkVirtualScrollViewport.prototype.ngOnInit = function (this: CdkVirtualScrollViewport) {
      (this as any)["_measureViewportSize"]();
      (this as any)["_scrollStrategy"].attach(this);
    };
  });
  afterAll(() => {
    CdkVirtualScrollViewport.prototype.ngOnInit = originalNgOnInit;
  });

  /** The bulk actions bar, as rendered into the layout's footer region. */
  const bulkBar = (): HTMLElement | null => {
    // Runs the `afterNextRender` that hands the bar to the footer, then renders the footer.
    TestBed.tick();
    footerFixture.detectChanges();
    return footerFixture.nativeElement.querySelector("bit-bulk-actions-bar");
  };

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
        provideRouter([]),
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        {
          provide: CipherService,
          useValue: { cipherListViewsIncludingRestricted$: () => cipherListViews$ },
        },
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

    footerFixture = TestBed.createComponent(FooterOutletComponent);
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
    it("holds room below the table for the bar while rows are selected", () => {
      const host: HTMLElement = fixture.nativeElement;
      expect(host.style.marginBottom).toBe("0px");

      selectRow("Banking");
      expect(host.style.marginBottom).toBe("53px");

      selectRow("Banking");
      expect(host.style.marginBottom).toBe("0px");
    });

    it("shows the selected count on the bar and clears the selection on dismiss", () => {
      selectAll();

      const bar = bulkBar()!;
      expect(bar.textContent).toContain("3");
      expect(bar.textContent).toContain("delete");

      bar.querySelector<HTMLButtonElement>("button[icon='bwi-clear']")!.click();
      fixture.detectChanges();

      expect(component["selected"]()).toEqual([]);
      expect(checkedRows()).toEqual([false, false, false]);
    });

    it("confirms with the pluralised copy, deletes each folder and shows the plural toast", async () => {
      selectAll();

      await component["deleteSelected"]();

      expect(openDeleteDialog).toHaveBeenCalledWith(dialogService, { count: 3 });
      const [deletedIds, deletedUserId] = folderApiService.deleteMany.mock.calls[0];
      expect([...deletedIds].sort()).toEqual(["1", "2", "3"]);
      expect(deletedUserId).toBe(userId);
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

  describe("virtual scroll", () => {
    it("renders only the rows in the scroll window, with no paginator", () => {
      folderViews$.next(Array.from({ length: 60 }, (_, i) => folder(`${i}`, `Folder ${i}`)));
      fixture.detectChanges();

      const rendered = fixture.debugElement.queryAll(By.css("bit-row")).length;
      expect(rendered).toBeGreaterThan(0);
      expect(rendered).toBeLessThan(60);
      expect(fixture.nativeElement.querySelector("cdk-virtual-scroll-viewport")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-table-paginator")).toBeNull();
    });
  });

  describe("nested folders", () => {
    const names = () =>
      fixture.debugElement
        .queryAll(By.css("bit-row"))
        .map((row) => row.query(By.css("a[bitLink]")).nativeElement.textContent.trim());

    const subtitleOf = (id: string): string | undefined =>
      fixture.debugElement
        .query(By.css(`#my-folders_link_name-${id}`))
        .nativeElement.closest("[role=cell]")
        .querySelector("[slot=secondary]")
        ?.textContent.trim();

    beforeEach(() => {
      folderViews$.next([
        folder("1", "Family"),
        folder("2", "Family/Kids"),
        folder("3", "Family/Kids/Toys"),
        folder("4", "Family/Pets"),
        folder("5", "Work"),
        folder("6", "Work/Projects"),
      ]);
      cipherListViews$.next([cipher("1"), cipher("2"), cipher("3"), cipher("5")]);
      fixture.detectChanges();
    });

    it("lists only the top-level folders", () => {
      expect(names()).toEqual(["Family", "Work"]);
    });

    it("counts the folders directly inside a parent in its subtitle", () => {
      expect(subtitleOf("1")).toBe("nestedFolderCount 2");
    });

    it("uses the singular subtitle for a single nested folder", () => {
      expect(subtitleOf("5")).toBe("nestedFolderSingular");
    });

    it("shows no subtitle for a folder with nothing nested", () => {
      folderViews$.next([folder("1", "Family")]);
      fixture.detectChanges();

      expect(subtitleOf("1")).toBeUndefined();
    });

    it("shows the items in the whole tree under a folder", () => {
      const counts = fixture.debugElement
        .queryAll(By.css("bit-row"))
        .map((row) => row.queryAll(By.css("[role=cell]"))[2].nativeElement.textContent.trim());

      expect(counts).toEqual(["3", "1"]);
    });

    it("links each name to the folder's own page", () => {
      const link = fixture.debugElement.query(By.css("#my-folders_link_name-1"));

      expect(link.nativeElement.getAttribute("href")).toBe("/folders/1");
    });

    it("matches search against top-level names only", () => {
      expect(component["filter"](component["rows"]()[0], { search: "kids" })).toBe(false);
      expect(component["filter"](component["rows"]()[0], { search: "fam" })).toBe(true);
    });
  });
});
