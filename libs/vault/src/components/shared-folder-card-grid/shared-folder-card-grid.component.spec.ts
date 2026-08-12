import { LiveAnnouncer } from "@angular/cdk/a11y";
import { signal } from "@angular/core";
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
import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

import { SharedFolderCardGridComponent } from "./shared-folder-card-grid.component";

/** Three columns × three rows render before the rest collapse. */
const COLLAPSED_CARD_COUNT = 9;

const TRIGGER_SELECTOR = "#shared-folder-card-grid_button_toggle-overflow";

describe("SharedFolderCardGridComponent", () => {
  let fixture: ComponentFixture<SharedFolderCardGridComponent>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;

  const filter$ = new BehaviorSubject<RoutedVaultFilterModel>({});
  const vfo1Enabled = signal(false);
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

  function countLabel(): string | undefined {
    return fixture.nativeElement.querySelector("section span")?.textContent?.trim();
  }

  function cardLinks(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("a[bit-item-content]"));
  }

  function trigger(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(TRIGGER_SELECTOR);
  }

  beforeEach(async () => {
    filter$.next({});
    vfo1Enabled.set(false);
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
        {
          provide: Vfo1TerminologyService,
          useValue: {
            enabled: vfo1Enabled,
            iconClass: (icon: string) => (vfo1Enabled() ? "bwi-shared-folder" : icon),
          },
        },
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
        expect(card.querySelector("bit-icon-tile i")?.classList).toContain("bwi-collection-shared");
        expect(card.querySelector(".bwi-angle-right")).not.toBeNull();
      });
    });

    it("borders each card on all four sides rather than as a stacked list row", () => {
      createComponent(folderNodes(2));

      // `bit-item` defaults to `tw-border-0 tw-border-b` for stacked rows; these cards stand alone
      // and use the same border token as `BaseCardDirective`.
      fixture.nativeElement.querySelectorAll("bit-item").forEach((item: HTMLElement) => {
        expect(item.classList).toContain("!tw-border");
        expect(item.classList).toContain("!tw-border-border-base");
      });
    });

    it("renders nothing when the parent passes an empty list", () => {
      createComponent([]);

      expect(fixture.nativeElement.querySelector("section")).toBeNull();
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

    it("collapses the overflow rows inside a disclosure controlled by the trigger", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 3));

      const disclosure = fixture.nativeElement.querySelector("bit-disclosure");
      expect(disclosure.classList).toContain("tw-hidden");
      expect(disclosure.querySelectorAll("a[bit-item-content]")).toHaveLength(3);
      expect(trigger()?.textContent?.trim()).toBe("showAll");
    });

    it("reflects the open state on the trigger's aria-expanded", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 1));

      expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
      expect(trigger()?.getAttribute("aria-controls")).toBe(
        fixture.nativeElement.querySelector("bit-disclosure").id,
      );

      trigger()?.click();
      fixture.detectChanges();

      expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
      expect(trigger()?.textContent?.trim()).toBe("showLess");
      expect(fixture.nativeElement.querySelector("bit-disclosure").classList).not.toContain(
        "tw-hidden",
      );
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

      expect(liveAnnouncer.announce).toHaveBeenCalledWith("moreCollectionsShownAbove:4", "polite");
    });

    it("announces shared folder terminology when the flag is on", () => {
      vfo1Enabled.set(true);
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

      expect(fixture.nativeElement.querySelector("h2").textContent.trim()).toBe(
        "collectionsInParent:Engineering",
      );
    });

    it("shows the child count alongside the title", () => {
      createComponent(folderNodes(16));

      expect(countLabel()).toBe("collectionCount:16");
    });

    it("counts every child, not just the rows on show", () => {
      createComponent(folderNodes(COLLAPSED_CARD_COUNT + 7));

      expect(cardLinks()).toHaveLength(COLLAPSED_CARD_COUNT + 7);
      expect(countLabel()).toBe(`collectionCount:${COLLAPSED_CARD_COUNT + 7}`);
    });
  });

  describe("terminology", () => {
    it("uses the legacy terms for the title and count when the flag is off", () => {
      createComponent(folderNodes(2), "Engineering");

      expect(fixture.nativeElement.querySelector("h2").textContent.trim()).toBe(
        "collectionsInParent:Engineering",
      );
      expect(countLabel()).toBe("collectionCount:2");
    });

    it("uses shared folder terms for the title and count when the flag is on", () => {
      vfo1Enabled.set(true);
      createComponent(folderNodes(2), "Engineering");

      expect(fixture.nativeElement.querySelector("h2").textContent.trim()).toBe(
        "sharedFoldersInParent:Engineering",
      );
      expect(countLabel()).toBe("sharedFolderCount:2");
    });

    it("keeps the shared collection icon when the flag is off", () => {
      createComponent(folderNodes(1));

      expect(cardLinks()[0].querySelector("bit-icon-tile i")?.classList).toContain(
        "bwi-collection-shared",
      );
    });

    it("swaps the folder icon when the flag is on", () => {
      vfo1Enabled.set(true);
      createComponent(folderNodes(1));

      expect(cardLinks()[0].querySelector("bit-icon-tile i")?.classList).toContain(
        "bwi-shared-folder",
      );
    });

    it("names the section with its heading", () => {
      createComponent(folderNodes(1));

      const section = fixture.nativeElement.querySelector("section");
      const heading = fixture.nativeElement.querySelector("h2");
      expect(section.getAttribute("aria-labelledby")).toBe(heading.id);
    });
  });
});
