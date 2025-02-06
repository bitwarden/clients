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

import { FoldersV2Component } from "./folders-v2.component";

@Component({
  standalone: true,
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  @Input() pageTitle: string = "";
  @Input() backAction: () => void = () => {};
}

@Component({
  standalone: true,
  selector: "popup-footer",
  template: `<ng-content></ng-content>`,
})
class MockPopupFooterComponent {
  @Input() pageTitle: string = "";
}

describe("FoldersV2Component", () => {
  let component: FoldersV2Component;
  let fixture: ComponentFixture<FoldersV2Component>;
  const folderViews$ = new BehaviorSubject<FolderView[]>([]);
  const open = jest.spyOn(AddEditFolderDialogComponent, "open");
  const mockDialogService = { open: jest.fn() };

  beforeEach(async () => {
    open.mockClear();

    await TestBed.configureTestingModule({
      imports: [FoldersV2Component],
      providers: [
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: FolderService, useValue: { folderViews$: () => folderViews$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: mockAccountServiceWith("UserId" as UserId) },
      ],
    })
      .overrideComponent(FoldersV2Component, {
        remove: {
          imports: [PopupHeaderComponent, PopupFooterComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupFooterComponent],
        },
      })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(FoldersV2Component);
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

  it("removes the last option in the folder array", (done) => {
    component.folders$.subscribe((folders) => {
      expect(folders).toEqual([
        { id: "1", name: "Folder 1" },
        { id: "2", name: "Folder 2" },
      ]);
      done();
    });
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
