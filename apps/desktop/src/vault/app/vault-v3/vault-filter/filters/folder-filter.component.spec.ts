import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { SideNavService } from "@bitwarden/components";
import { FolderFilter } from "@bitwarden/vault";

import { PersistedVaultFilterExpansionService } from "../services/persisted-vault-filter-expansion.service";

import { FolderFilterComponent } from "./folder-filter.component";

describe("FolderFilterComponent", () => {
  let fixture: ComponentFixture<FolderFilterComponent>;
  let collapseService: MockProxy<PersistedVaultFilterExpansionService>;

  const folderWithChildren = () => {
    const parent = new TreeNode<FolderFilter>(
      { id: "parent", name: "Parent" } as FolderFilter,
      null,
    );
    parent.children = [
      new TreeNode<FolderFilter>({ id: "child", name: "Child" } as FolderFilter, parent),
    ];
    return parent;
  };

  const setup = async (open: boolean) => {
    collapseService = mock<PersistedVaultFilterExpansionService>();
    collapseService.isOpen.mockReturnValue(open);
    collapseService.setOpen.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [FolderFilterComponent],
      providers: [
        provideRouter([]),
        { provide: PersistedVaultFilterExpansionService, useValue: collapseService },
        { provide: SideNavService, useValue: mock<SideNavService>({ open: () => true }) },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FolderFilterComponent);
    fixture.componentRef.setInput("folder", folderWithChildren());
    fixture.detectChanges();
  };

  const navGroup = () => fixture.debugElement.query(By.css("bit-nav-group"));

  it("reads open state from the collapse service, keyed by the folder's node id", async () => {
    await setup(true);

    expect(navGroup().componentInstance.open()).toBe(true);
    expect(collapseService.isOpen).toHaveBeenCalledWith("parent");
  });

  it("renders collapsed when the collapse service reports the node as collapsed", async () => {
    await setup(false);

    expect(navGroup().componentInstance.open()).toBe(false);
  });

  it("persists the node id as collapsed when the user closes the group", async () => {
    await setup(true);

    navGroup().componentInstance.setOpen(false);
    fixture.detectChanges();

    expect(collapseService.setOpen).toHaveBeenCalledWith("parent", false);
  });

  it("persists the node id as expanded when the user re-opens a collapsed group", async () => {
    await setup(false);

    navGroup().componentInstance.setOpen(true);
    fixture.detectChanges();

    expect(collapseService.setOpen).toHaveBeenCalledWith("parent", true);
  });

  it("does not persist an open change that fires before the component settles", async () => {
    await setup(true);
    const instance = fixture.componentInstance as unknown as {
      settled: { set: (v: boolean) => void };
      onOpenChange: (open: boolean) => void;
    };
    instance.settled.set(false);

    instance.onOpenChange(false);

    expect(collapseService.setOpen).not.toHaveBeenCalled();
  });
});
