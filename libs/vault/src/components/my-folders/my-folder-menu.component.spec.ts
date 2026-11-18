import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { MyFolderActionsService } from "../../services/my-folder-actions.service";

import { MyFolderMenuComponent } from "./my-folder-menu.component";

const buildFolder = (id: string | null, name: string) => {
  const folder = new FolderView();
  folder.id = id as string;
  folder.name = name;
  return folder;
};

describe("MyFolderMenuComponent", () => {
  let fixture: ComponentFixture<MyFolderMenuComponent>;
  let folders$: BehaviorSubject<FolderView[]>;

  const folderActions = mock<MyFolderActionsService>();
  const router = mock<Router>();

  const setup = (folderId: string, folders: FolderView[]) => {
    folders$ = new BehaviorSubject(folders);

    const folderService = mock<FolderService>();
    folderService.folderViews$.mockReturnValue(folders$);

    TestBed.configureTestingModule({
      imports: [MyFolderMenuComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-1" as UserId }) },
        },
        { provide: FolderService, useValue: folderService },
        { provide: MyFolderActionsService, useValue: folderActions },
        { provide: Router, useValue: router },
      ],
    });

    fixture = TestBed.createComponent(MyFolderMenuComponent);
    fixture.componentRef.setInput("folderId", folderId);
    fixture.detectChanges();
  };

  const trigger = () => fixture.debugElement.query(By.css("#my-folder-menu_button_options"));

  /** The menu renders into an overlay outside the fixture, once its trigger is clicked. */
  const openMenu = () => {
    trigger().nativeElement.click();
    fixture.detectChanges();
  };

  const menuItem = (action: "edit" | "delete") =>
    document.body.querySelector<HTMLButtonElement>(`#my-folder-menu_button_${action}`);

  beforeEach(() => {
    jest.resetAllMocks();
    folderActions.delete.mockResolvedValue(true);
    router.navigate.mockResolvedValue(true);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("offers the folder's options from a trigger button", () => {
    setup("work", [buildFolder("work", "Work")]);

    expect(trigger()).not.toBeNull();
    expect(menuItem("edit")).toBeNull();
  });

  it("offers edit and delete once opened, as the My folders table does", () => {
    setup("work", [buildFolder("work", "Work")]);

    openMenu();

    expect(menuItem("edit")?.textContent).toContain("edit");
    expect(menuItem("delete")?.textContent).toContain("delete");
  });

  it("opens the edit dialog for the folder in view", () => {
    setup("work", [buildFolder("work", "Work")]);
    openMenu();

    menuItem("edit")!.click();

    expect(folderActions.edit).toHaveBeenCalledWith("work");
  });

  it("confirms the delete with the folder's own name, not its parent path", () => {
    setup("kids", [buildFolder("family", "Family"), buildFolder("kids", "Family/Kids")]);
    openMenu();

    menuItem("delete")!.click();

    expect(folderActions.delete).toHaveBeenCalledWith({ id: "kids", displayName: "Kids" });
  });

  it("returns to the My folders list once the folder is deleted", async () => {
    setup("work", [buildFolder("work", "Work")]);

    await fixture.componentInstance["delete"]();

    expect(router.navigate).toHaveBeenCalledWith(["/folders"]);
  });

  it("stays on the folder's page when the delete is cancelled or fails", async () => {
    folderActions.delete.mockResolvedValue(false);
    setup("work", [buildFolder("work", "Work")]);

    await fixture.componentInstance["delete"]();

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("offers nothing for a folder the user does not hold", () => {
    setup("missing", [buildFolder("work", "Work")]);

    expect(trigger()).toBeNull();
  });

  it("stops offering the menu once the folder has been deleted", () => {
    setup("work", [buildFolder("work", "Work")]);

    folders$.next([]);
    fixture.detectChanges();

    expect(trigger()).toBeNull();
  });

  it("ignores the entry standing in for items with no folder", () => {
    setup("work", [buildFolder(null, "No folder"), buildFolder("work", "Work")]);

    expect(trigger()).not.toBeNull();
  });
});
