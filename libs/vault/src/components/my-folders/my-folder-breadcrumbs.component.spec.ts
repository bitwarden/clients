import { DebugElement } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { MyFolderBreadcrumbsComponent } from "./my-folder-breadcrumbs.component";

const buildFolder = (id: string | null, name: string) => {
  const folder = new FolderView();
  folder.id = id as string;
  folder.name = name;
  return folder;
};

type SetupOptions = {
  folders?: FolderView[];
  /** Query params on the folder's URL, as the table writes when a filter is applied. */
  query?: string;
};

/**
 * A crumb is projected into `bit-breadcrumbs` as a template rather than an element, so the
 * `bit-breadcrumb` hosts never reach the DOM — these assert on what each crumb renders as instead:
 * a link for a crumb pointing elsewhere, a button for one with no destination, and the
 * `aria-current="page"` element for the active one.
 */
describe("MyFolderBreadcrumbsComponent", () => {
  let harness: RouterTestingHarness;

  async function setup(folderId: string, options: SetupOptions = {}): Promise<void> {
    const { folders = [], query = "" } = options;

    TestBed.configureTestingModule({
      providers: [
        // The route's `:folderId` binds to the component's `folderId` input.
        provideRouter(
          [{ path: "folders/:folderId", component: MyFolderBreadcrumbsComponent }],
          withComponentInputBinding(),
        ),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: AccountService,
          useValue: { activeAccount$: new BehaviorSubject({ id: "user-1" as UserId }) },
        },
        { provide: FolderService, useValue: { folderViews$: () => of(folders) } },
      ],
    });

    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/folders/${folderId}${query}`);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const root = () => harness.fixture.debugElement;

  function links(): DebugElement[] {
    return root().queryAll(By.css("a[href]"));
  }

  function hrefs(): string[] {
    return links().map((link) => link.nativeElement.getAttribute("href"));
  }

  function activeCrumb(): DebugElement {
    return root().query(By.css('[aria-current="page"]'));
  }

  const work = buildFolder("work", "Work");
  const projects = buildFolder("projects", "Work/Projects");
  const acme = buildFolder("acme", "Work/Projects/Acme");

  it("trails a top-level folder from My folders to the folder", async () => {
    await setup("work", { folders: [work] });

    expect(root().nativeElement.textContent).toMatch(/myFolders.*Work/);
    expect(hrefs()).toEqual(["/folders"]);
    expect(activeCrumb().nativeElement.textContent).toContain("Work");
  });

  it("links My folders back to the My folders list", async () => {
    await setup("work", { folders: [work] });

    const [myFolders] = links();
    expect(myFolders.nativeElement.getAttribute("href")).toBe("/folders");
    expect(myFolders.nativeElement.textContent).toContain("myFolders");
  });

  it("trails a nested folder through each of its ancestors, linked to their own pages", async () => {
    await setup("acme", { folders: [work, projects, acme] });

    expect(hrefs()).toEqual(["/folders", "/folders/work", "/folders/projects"]);
    expect(root().nativeElement.textContent).toMatch(/myFolders.*Work.*Projects.*Acme/);
    expect(activeCrumb().nativeElement.textContent).toContain("Acme");
  });

  it("starts the trail at My folders, with no crumb before it", async () => {
    await setup("work", { folders: [work] });

    expect(root().nativeElement.textContent.trim().startsWith("myFolders")).toBe(true);
  });

  it("keeps the folder crumb active once the table writes its filters to the URL", async () => {
    await setup("work", { folders: [work], query: "?search=bank" });

    expect(activeCrumb().nativeElement.textContent).toContain("Work");
  });

  it("trails a folder with no name flat, under an em-dash", async () => {
    await setup("unnamed", { folders: [work, buildFolder("unnamed", "")] });

    expect(hrefs()).toEqual(["/folders"]);
    expect(activeCrumb().nativeElement.textContent).toContain("—");
  });

  it("ignores the entry standing in for items with no folder", async () => {
    await setup("work", { folders: [buildFolder(null, "No folder"), work] });

    expect(activeCrumb().nativeElement.textContent).toContain("Work");
  });

  it("renders nothing for a folder the user does not hold", async () => {
    await setup("missing", { folders: [work] });

    expect(root().query(By.css("bit-breadcrumbs"))).toBeNull();
  });
});
