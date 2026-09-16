import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { SideNavService } from "@bitwarden/components";
import { CollectionFilter } from "@bitwarden/vault";

import { PersistedVaultFilterExpansionService } from "../services/persisted-vault-filter-expansion.service";

import { CollectionFilterComponent } from "./collection-filter.component";

describe("CollectionFilterComponent", () => {
  let fixture: ComponentFixture<CollectionFilterComponent>;
  let collapseService: MockProxy<PersistedVaultFilterExpansionService>;

  const collectionWithChildren = () => {
    const parent = new TreeNode<CollectionFilter>(
      { id: "parent", name: "Parent" } as CollectionFilter,
      null,
    );
    parent.children = [
      new TreeNode<CollectionFilter>({ id: "child", name: "Child" } as CollectionFilter, parent),
    ];
    return parent;
  };

  const setup = async (open: boolean) => {
    collapseService = mock<PersistedVaultFilterExpansionService>();
    collapseService.isOpen.mockReturnValue(open);
    collapseService.setOpen.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [CollectionFilterComponent],
      providers: [
        provideRouter([]),
        { provide: PersistedVaultFilterExpansionService, useValue: collapseService },
        { provide: SideNavService, useValue: mock<SideNavService>({ open: () => true }) },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionFilterComponent);
    fixture.componentRef.setInput("collection", collectionWithChildren());
    fixture.detectChanges();
  };

  const navGroup = () => fixture.debugElement.query(By.css("bit-nav-group"));

  it("reads open state from the collapse service, keyed by the collection's node id", async () => {
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
});
