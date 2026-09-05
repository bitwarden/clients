import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService } from "@bitwarden/components";
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";

import { FoldersComponent } from "./folders.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle: string = "";
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() backAction: () => void = () => {};
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-footer",
  template: `<ng-content></ng-content>`,
})
class MockPopupFooterComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle: string = "";
}

describe("FoldersComponent", () => {
  let component: FoldersComponent;
  let fixture: ComponentFixture<FoldersComponent>;
  const folderViews$ = new BehaviorSubject<FolderView[]>([]);
  const vfo1Enabled$ = new BehaviorSubject<boolean>(false);
  const open = jest.spyOn(AddEditFolderDialogComponent, "open");
  const mockDialogService = { open: jest.fn() };

  beforeEach(async () => {
    open.mockClear();
    vfo1Enabled$.next(false);

    await TestBed.configureTestingModule({
      imports: [FoldersComponent],
      providers: [
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => vfo1Enabled$ } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: FolderService, useValue: { folderViews$: () => folderViews$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: mockAccountServiceWith("UserId" as UserId) },
      ],
    })
      .overrideComponent(FoldersComponent, {
        remove: {
          imports: [PopupHeaderComponent, PopupFooterComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupFooterComponent],
        },
      })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(FoldersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  beforeEach(() => {
    folderViews$.next([
      { id: "1", name: "Folder 1" },
      { id: "2", name: "Folder 2" },
      { id: "0", name: "No Folder" },
    ] as FolderView[]);
    fixture.detectChanges();
  });

  it("should show all folders", (done) => {
    component.folders$.subscribe((folders) => {
      expect(folders).toEqual([
        { id: "1", name: "Folder 1" },
        { id: "2", name: "Folder 2" },
        { id: "0", name: "No Folder" },
      ]);
      done();
    });
  });

  it("filters out the id-less 'My Folder' entry when vfo1 is enabled", (done) => {
    vfo1Enabled$.next(true);
    folderViews$.next([
      { id: "1", name: "Folder 1" },
      { id: "2", name: "Folder 2" },
      { id: "", name: "No Folder" },
    ] as FolderView[]);
    fixture.detectChanges();

    component.folders$.subscribe((folders) => {
      expect(folders).toEqual([
        { id: "1", name: "Folder 1" },
        { id: "2", name: "Folder 2" },
      ]);
      done();
    });
  });

  it("shows the vfo1 empty state when only the id-less 'My Folder' entry remains and vfo1 is enabled", () => {
    vfo1Enabled$.next(true);
    folderViews$.next([{ id: "", name: "No Folder" }] as FolderView[]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("youHaveNoFolders");
    expect(fixture.nativeElement.textContent).toContain("emptyFoldersDescription");
    expect(
      fixture.debugElement.query(By.css('[data-testid="empty-new-folder-button"]')),
    ).toBeFalsy();
  });

  it("opens edit dialog for existing folder", () => {
    const folder = { id: "1", name: "Folder 1" } as FolderView;
    const editButton = fixture.debugElement.query(By.css('[data-testid="edit-folder-button"]'));

    editButton.triggerEventHandler("click");

    expect(open).toHaveBeenCalledWith(mockDialogService, { editFolderConfig: { folder } });
  });

  it("opens add dialog for new folder when there are no folders", () => {
    folderViews$.next([]);
    fixture.detectChanges();

    const addButton = fixture.debugElement.query(By.css('[data-testid="empty-new-folder-button"]'));

    addButton.triggerEventHandler("click");

    expect(open).toHaveBeenCalledWith(mockDialogService, {});
  });
});
