import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NavigationExtras, provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { RoutedVaultFilterModel } from "../../models/routed-vault-filter.model";
import { RoutedVaultFilterService } from "../../services/routed-vault-filter.service";

import { SharedFolderCardGridComponent } from "./shared-folder-card-grid.component";

/** Nine cards — three columns × three rows at full width — render before the rest collapse. */
const COLLAPSED_CARD_COUNT = 9;

const TRIGGER_SELECTOR = "#shared-folder-card-grid_button_toggle-overflow";

describe("SharedFolderCardGridComponent", () => {
  let fixture: ComponentFixture<SharedFolderCardGridComponent>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;

  const filter$ = new BehaviorSubject<RoutedVaultFilterModel>({});
  const createRoute = jest.fn<[unknown[], NavigationExtras], [RoutedVaultFilterModel]>();

  function folderNode(id: string, name: string): TreeNode<CollectionView> {
    const collection = new CollectionView({
      id: id as CollectionId,
      organizationId: "org-1" as OrganizationId,
      name,
    });

    return new TreeNode(collection, undefined as unknown as TreeNode<CollectionView>);
  }

  function folderNodes(count: number): TreeNode<CollectionView>[] {
    return Array.from({ length: count }, (_, i) => folderNode(`folder-${i}`, `Folder ${i}`));
  }

  function createComponent(folders: TreeNode<CollectionView>[], parentName = "Engineering") {
    fixture = TestBed.createComponent(SharedFolderCardGridComponent);
    fixture.componentRef.setInput("folders", folders);
    fixture.componentRef.setInput("parentName", parentName);
    fixture.detectChanges();
  }

  /** The count is projected into the accordion trigger's `end` slot, alongside the title. */
  function countLabel(): string | undefined {
    return fixture.nativeElement.querySelector('[slot="end"]')?.textContent?.trim();
  }

  /** `bit-accordion` renders its `title` input as the first span in its trigger. */
  function accordionTitle(): string | undefined {
    return fixture.nativeElement
      .querySelector('[data-accordion-trigger] span:not([slot="end"])')
      ?.textContent?.trim();
  }

  function cardLinks(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("a[bit-item-content]"));
  }

  function trigger(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(TRIGGER_SELECTOR);
  }

  beforeEach(async () => {
    filter$.next({});
    liveAnnouncer = mock<LiveAnnouncer>();

    createRoute.mockReset();
    createRoute.mockImplementation((filter) => [
      ["/vault"],
      {
        queryParams: { sharedFolderId: filter.collectionId ?? null },
        queryParamsHandling: "merge",
        state: { focusAfterNav: false },
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [SharedFolderCardGridComponent],
      providers: [
        provideRouter([]),
        {
          provide: I18nService,
          useValue: {
            // `I18nPipe` always forwards three positional params, so drop the unfilled ones.
            t: (key: string, ...params: (string | number | undefined)[]) => {
              const provided = params.filter((param) => param !== undefined);
              return provided.length > 0 ? `${key}:${provided.join(",")}` : key;
            },
          },
        },
        { provide: LiveAnnouncer, useValue: liveAnnouncer },
        { provide: RoutedVaultFilterService, useValue: { filter$, createRoute } },
      ],
    }).compileComponents();
  });

  describe("rendering child folders", () => {
    it("renders each child as a card with a folder icon, name, and trailing chevron", () => {
      createComponent(folderNodes(2));

      const cards = cardLinks();
      expect(cards).toHaveLength(2);
      expect(cards.map((card) => card.textContent?.trim())).toEqual(["Folder 0", "Folder 1"]);

      cards.forEach((card) => {
        expect(card.querySelector("bit-icon-tile i")?.classList).toContain("bwi-shared-folder");
        expect(card.querySelector(".bwi-angle-right")).not.toBeNull();
      });
    });

    // This test needs the updates to bit-items in CL-982
    // it("borders each card on all four sides rather than as a stacked list row", () => {
    //   createComponent(folderNodes(2));

    //   // Each card stands alone rather than sitting in a stacked list, so it carries `bit-item`'s own
    //   // border on all four sides — no grid-local override.
    //   fixture.nativeElement.querySelectorAll("bit-item").forEach((item: HTMLElement) => {
    //     expect(item.classList).toContain("tw-border");
    //     expect(item.classList).toContain("tw-border-border-base");
    //   });
    // });

    it("renders nothing when the parent passes an empty list", () => {
      createComponent([]);

      expect(fixture.nativeElement.querySelector("bit-accordion")).toBeNull();
      expect(cardLinks()).toHaveLength(0);
    });

    it("caps the grid at three columns, each at least 240px wide, with 12px spacing", () => {
      createComponent(folderNodes(3));

      const grid: HTMLElement = fixture.nativeElement.querySelector("ul");
      expect(grid.classList).toContain("tw-gap-3");
      expect(grid.style.gridTemplateColumns).toBe(
        "repeat(auto-fill, minmax(min(100%, max(240px, (100% - 1.5rem) / 3)), 1fr))",
      );
    });
  });

  describe("card links", () => {
    it("builds each href from RoutedVaultFilterService.createRoute for that child", () => {
      createComponent(folderNodes(1));

      expect(createRoute).toHaveBeenCalledWith(
        expect.objectContaining({ collectionId: "folder-0" }),
      );
      expect(cardLinks()[0].getAttribute("href")).toBe("/vault?sharedFolderId=folder-0");
    });

    it("keeps the surrounding filter and clears the filters a collection cannot combine with", () => {
      filter$.next({
        organizationId: "org-1" as OrganizationId,
        organizationIdParamType: "query",
        folderId: "folder-to-clear",
        type: "login",
      });

      createComponent(folderNodes(1));

      expect(createRoute).toHaveBeenCalledWith({
        organizationId: "org-1",
        organizationIdParamType: "query",
        collectionId: "folder-0",
        folderId: undefined,
        type: undefined,
      });
    });

    it("renders cards as anchors so click, Enter, and right/middle-click all navigate", () => {
      createComponent(folderNodes(1));

      const card = cardLinks()[0];
      expect(card.tagName).toBe("A");
      expect(card.getAttribute("href")).not.toBeNull();
    });
  });

  describe("overflow rows", () => {
    it("renders no trigger when the children fit in the first three rows", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT));

      expect(cardLinks()).toHaveLength(COLLAPSED_CARD_COUNT);
      expect(trigger()).toBeNull();
    });

    it("withholds the overflow cards until the trigger is used", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 3));

      expect(cardLinks()).toHaveLength(COLLAPSED_CARD_COUNT);
      expect(trigger()?.textContent?.trim()).toBe("showAll");

      trigger()?.click();
      fixture.detectChanges();

      expect(cardLinks()).toHaveLength(COLLAPSED_CARD_COUNT + 3);
      expect(trigger()?.textContent?.trim()).toBe("showLess");
    });

    it("appends the overflow cards to the same grid so they fill the last partial row", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 3));

      trigger()?.click();
      fixture.detectChanges();

      // A second grid below the first would restart at its own first column, leaving any empty slot
      // in the last row of the collapsed grid permanently blank.
      const grids = fixture.nativeElement.querySelectorAll("ul");
      expect(grids).toHaveLength(1);
      expect(grids[0].querySelectorAll("a[bit-item-content]")).toHaveLength(
        COLLAPSED_CARD_COUNT + 3,
      );
    });

    it("reflects the open state on the trigger's aria-expanded", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 1));

      expect(trigger()?.getAttribute("aria-expanded")).toBe("false");

      trigger()?.click();
      fixture.detectChanges();

      expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
    });

    it("points the trigger at the grid it reveals cards into", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 1));

      const gridId = fixture.nativeElement.querySelector("ul").id;
      expect(gridId).not.toBe("");
      expect(trigger()?.getAttribute("aria-controls")).toBe(gridId);
    });

    it("flips the trigger's caret to match the open state", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 1));

      expect(trigger()?.querySelector("i")?.classList).toContain("bwi-angle-down");

      trigger()?.click();
      fixture.detectChanges();

      expect(trigger()?.querySelector("i")?.classList).toContain("bwi-angle-up");
    });

    it("re-collapses when the host navigates to a folder with different children", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 1));

      trigger()?.click();
      fixture.detectChanges();
      expect(trigger()?.getAttribute("aria-expanded")).toBe("true");

      fixture.componentRef.setInput("folders", folderNodes(COLLAPSED_CARD_COUNT + 2));
      fixture.detectChanges();

      expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("announcing expansion", () => {
    it("announces how many rows were revealed above the trigger", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 4));

      trigger()?.click();
      fixture.detectChanges();

      expect(liveAnnouncer.announce).toHaveBeenCalledWith(
        "moreSharedFoldersShownAbove:4",
        "polite",
      );
    });

    it("does not announce on the initial collapsed render", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 4));

      expect(liveAnnouncer.announce).not.toHaveBeenCalled();
    });
  });

  describe("header", () => {
    it("titles the section with the parent folder name", () => {
      createComponent(folderNodes(2), "Engineering");

      expect(accordionTitle()).toBe("sharedFoldersInParent:Engineering");
    });

    it("shows the child count alongside the title", () => {
      createComponent(folderNodes(16));

      expect(countLabel()).toBe("sharedFolderCount:16");
    });

    it("uses the singular sentence for a lone child", () => {
      createComponent(folderNodes(1));

      expect(countLabel()).toBe("sharedFolderSingular:1");
    });

    it("emphasizes the number without splitting the translated sentence", () => {
      createComponent(folderNodes(16));

      // The sentinel is substituted into the whole translated sentence, which is then split around
      // it, so the count is bold while the surrounding words keep their translated order.
      const emphasized = fixture.nativeElement.querySelector('[slot="end"] strong');
      expect(emphasized.textContent).toBe("16");
      expect(emphasized.classList).toContain("tw-font-bold");
      expect(countLabel()).toBe("sharedFolderCount:16");
      expect(countLabel()).not.toContain("\uFFFC");
    });

    it("counts every child, not just the rows on show", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 7));

      expect(cardLinks()).toHaveLength(COLLAPSED_CARD_COUNT);
      expect(countLabel()).toBe(`sharedFolderCount:${COLLAPSED_CARD_COUNT + 7}`);
    });

    it("names the region holding the cards with the titled accordion trigger", () => {
      createComponent(folderNodes(1));

      const region = fixture.nativeElement.querySelector("[data-accordion-content]");
      const accordionTrigger = fixture.nativeElement.querySelector("[data-accordion-trigger]");

      expect(region.getAttribute("aria-labelledby")).toBe(accordionTrigger.id);
      expect(region.querySelector("a[bit-item-content]")).not.toBeNull();
    });
  });
});
