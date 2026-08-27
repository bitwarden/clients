import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { VaultScope, VaultScopeType } from "../../models/vault-scope";

import { SharedFolderCardGridComponent } from "./shared-folder-card-grid.component";

/** Nine cards — three columns × three rows at full width — render before the rest collapse. */
const COLLAPSED_CARD_COUNT = 9;

const TRIGGER_SELECTOR = "#shared-folder-card-grid_button_toggle-overflow";

const organizationId = "org-1" as OrganizationId;

/** The folder the scope drills into by default, and the one most suites hang children off. */
const PARENT = { id: "engineering" as CollectionId, name: "Engineering" };

describe("SharedFolderCardGridComponent", () => {
  let fixture: ComponentFixture<SharedFolderCardGridComponent>;
  let liveAnnouncer: MockProxy<LiveAnnouncer>;

  /** The organization vault, drilled into a shared folder — the only scope that holds one. */
  const scopeTo = (collectionId?: CollectionId): VaultScope => ({
    type: VaultScopeType.Organization,
    organizationId,
    collectionId,
  });

  function collection(id: string, name: string): CollectionView {
    return new CollectionView({ id: id as CollectionId, organizationId, name });
  }

  /**
   * A folder and `count` children beneath it, flat and nested by name — the shape the collection
   * services hold, which the grid resolves into a tree of its own.
   */
  function folderTree(
    parent: { id: CollectionId; name: string } = PARENT,
    count = 0,
  ): CollectionView[] {
    return [
      collection(parent.id, parent.name),
      ...Array.from({ length: count }, (_, i) =>
        collection(`${parent.id}-folder-${i}`, `${parent.name}/Folder ${i}`),
      ),
    ];
  }

  /** {@link folderTree} for the default parent, which the default scope drills into. */
  function children(count: number): CollectionView[] {
    return folderTree(PARENT, count);
  }

  function createComponent(collections: CollectionView[], scope: VaultScope = scopeTo(PARENT.id)) {
    fixture = TestBed.createComponent(SharedFolderCardGridComponent);
    fixture.componentRef.setInput("collections", collections);
    fixture.componentRef.setInput("scope", scope);
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

  /** The cards themselves, distinguished from the overflow trigger by their `bit-item-content`. */
  function cards(): HTMLAnchorElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("a[bit-item-content]"));
  }

  function trigger(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(TRIGGER_SELECTOR);
  }

  beforeEach(async () => {
    liveAnnouncer = mock<LiveAnnouncer>();

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
      ],
    }).compileComponents();
  });

  describe("rendering child folders", () => {
    it("renders each child as a card with a folder icon, name, and trailing chevron", () => {
      createComponent(children(2));

      expect(cards()).toHaveLength(2);
      expect(cards().map((card) => card.textContent?.trim())).toEqual(["Folder 0", "Folder 1"]);

      cards().forEach((card) => {
        expect(card.querySelector("bit-icon-tile i")?.classList).toContain("bwi-shared-folder");
        expect(card.querySelector(".bwi-angle-right")).not.toBeNull();
      });
    });

    // This test needs the updates to bit-items in CL-982
    // it("borders each card on all four sides rather than as a stacked list row", () => {
    //   createComponent(children(2));

    //   // Each card stands alone rather than sitting in a stacked list, so it carries `bit-item`'s own
    //   // border on all four sides — no grid-local override.
    //   fixture.nativeElement.querySelectorAll("bit-item").forEach((item: HTMLElement) => {
    //     expect(item.classList).toContain("tw-border");
    //     expect(item.classList).toContain("tw-border-border-base");
    //   });
    // });

    it("renders nothing when the folder in view has no children", () => {
      createComponent(children(0));

      expect(fixture.nativeElement.querySelector("bit-accordion")).toBeNull();
      expect(cards()).toHaveLength(0);
    });

    it("shows only the direct children of the folder in view", () => {
      const grandchild = collection("platform", `${PARENT.name}/Folder 0/Platform`);
      createComponent([...children(2), grandchild]);

      // A grandchild arrives with the drill-in to its own parent, not before.
      expect(cards().map((card) => card.textContent?.trim())).toEqual(["Folder 0", "Folder 1"]);
    });

    it("caps the grid at three columns, each at least 240px wide, with 12px spacing", () => {
      createComponent(children(3));

      const grid: HTMLElement = fixture.nativeElement.querySelector("ul");
      expect(grid.classList).toContain("tw-gap-3");
      expect(grid.style.gridTemplateColumns).toBe(
        "repeat(auto-fill, minmax(min(100%, max(240px, (100% - 1.5rem) / 3)), 1fr))",
      );
    });
  });

  describe("the folder the scope names", () => {
    // Nesting is carried in the name, so the tree is derived rather than declared.
    const departments = collection("departments", "Departments");
    const engineering = collection(PARENT.id, "Departments/Engineering");
    const platform = collection("platform", "Departments/Engineering/Platform");
    const nested = [departments, engineering, platform];

    it("titles the section by the folder's own name rather than its full path", () => {
      createComponent(nested);

      expect(accordionTitle()).toBe("sharedFoldersInParent:Engineering");
      expect(cards().map((card) => card.textContent?.trim())).toEqual(["Platform"]);
    });

    it("renders nothing until the scope drills into a folder", () => {
      createComponent(nested, scopeTo());

      expect(fixture.nativeElement.querySelector("bit-accordion")).toBeNull();
    });

    // The scope of a personal vault, Trash, or the Archive holds no folder at all — only an
    // organization vault can be drilled into.
    it("renders nothing for a scope that can hold no folder", () => {
      createComponent(nested, { type: VaultScopeType.MyVault });

      expect(fixture.nativeElement.querySelector("bit-accordion")).toBeNull();
    });

    it("renders nothing for a folder the collections it is given do not hold", () => {
      createComponent(nested, scopeTo("another-vaults-folder" as CollectionId));

      expect(fixture.nativeElement.querySelector("bit-accordion")).toBeNull();
    });
  });

  describe("card links", () => {
    it("links each child to itself within the vault in view", () => {
      createComponent(children(2));

      expect(cards().map((card) => card.getAttribute("href"))).toEqual([
        "/vault/org-1/engineering-folder-0",
        "/vault/org-1/engineering-folder-1",
      ]);
    });

    // A folder's route names the vault it lives in, not the path taken to it.
    it("replaces the folder segment rather than nesting under it", () => {
      const engineering = collection(PARENT.id, "Departments/Engineering");
      const platform = collection("platform", "Departments/Engineering/Platform");
      createComponent([collection("departments", "Departments"), engineering, platform]);

      expect(cards()[0].getAttribute("href")).toBe("/vault/org-1/platform");
    });

    // Cmd/ctrl-click, middle-click, and Enter all have to open the folder, which only a real anchor
    // with an href gives for free.
    it("renders cards as anchors rather than buttons", () => {
      createComponent(children(1));

      const card = cards()[0];
      expect(card.tagName).toBe("A");
      expect(card.getAttribute("href")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("button[bit-item-content]")).toBeNull();
    });

    it("gives each card an id naming the folder it opens", () => {
      createComponent(children(1));

      expect(cards()[0].id).toBe("shared-folder-card-grid_link_folder-engineering-folder-0");
    });
  });

  describe("overflow rows", () => {
    it("renders no trigger when the children fit in the first three rows", () => {
      createComponent(children(COLLAPSED_CARD_COUNT));

      expect(cards()).toHaveLength(COLLAPSED_CARD_COUNT);
      expect(trigger()).toBeNull();
    });

    it("withholds the overflow cards until the trigger is used", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 3));

      expect(cards()).toHaveLength(COLLAPSED_CARD_COUNT);
      expect(trigger()?.textContent?.trim()).toBe("showAll");

      trigger()?.click();
      fixture.detectChanges();

      expect(cards()).toHaveLength(COLLAPSED_CARD_COUNT + 3);
      expect(trigger()?.textContent?.trim()).toBe("showLess");
    });

    it("appends the overflow cards to the same grid so they fill the last partial row", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 3));

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
      createComponent(children(COLLAPSED_CARD_COUNT + 1));

      expect(trigger()?.getAttribute("aria-expanded")).toBe("false");

      trigger()?.click();
      fixture.detectChanges();

      expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
    });

    it("points the trigger at the grid it reveals cards into", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 1));

      const gridId = fixture.nativeElement.querySelector("ul").id;
      expect(gridId).not.toBe("");
      expect(trigger()?.getAttribute("aria-controls")).toBe(gridId);
    });

    it("flips the trigger's caret to match the open state", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 1));

      expect(trigger()?.querySelector("i")?.classList).toContain("bwi-angle-down");

      trigger()?.click();
      fixture.detectChanges();

      expect(trigger()?.querySelector("i")?.classList).toContain("bwi-angle-up");
    });

    it("re-collapses when the scope moves to a folder with different children", () => {
      const design = { id: "design" as CollectionId, name: "Design" };
      createComponent([
        ...children(COLLAPSED_CARD_COUNT + 1),
        ...folderTree(design, COLLAPSED_CARD_COUNT + 2),
      ]);

      trigger()?.click();
      fixture.detectChanges();
      expect(trigger()?.getAttribute("aria-expanded")).toBe("true");

      fixture.componentRef.setInput("scope", scopeTo(design.id));
      fixture.detectChanges();

      expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("announcing expansion", () => {
    it("announces how many rows were revealed above the trigger", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 4));

      trigger()?.click();
      fixture.detectChanges();

      expect(liveAnnouncer.announce).toHaveBeenCalledWith(
        "moreSharedFoldersShownAbove:4",
        "polite",
      );
    });

    it("does not announce on the initial collapsed render", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 4));

      expect(liveAnnouncer.announce).not.toHaveBeenCalled();
    });
  });

  describe("header", () => {
    it("titles the section with the name of the folder in view", () => {
      createComponent(children(2));

      expect(accordionTitle()).toBe("sharedFoldersInParent:Engineering");
    });

    it("shows the child count alongside the title", () => {
      createComponent(children(16));

      expect(countLabel()).toBe("sharedFolderCount:16");
    });

    it("uses the singular sentence for a lone child", () => {
      createComponent(children(1));

      expect(countLabel()).toBe("sharedFolderSingular:1");
    });

    it("emphasizes the number without splitting the translated sentence", () => {
      createComponent(children(16));

      // The sentinel is substituted into the whole translated sentence, which is then split around
      // it, so the count is bold while the surrounding words keep their translated order.
      const emphasized = fixture.nativeElement.querySelector('[slot="end"] strong');
      expect(emphasized.textContent).toBe("16");
      expect(emphasized.classList).toContain("tw-font-bold");
      expect(countLabel()).toBe("sharedFolderCount:16");
      expect(countLabel()).not.toContain("\uFFFC");
    });

    it("counts every child, not just the rows on show", () => {
      createComponent(children(COLLAPSED_CARD_COUNT + 7));

      expect(cards()).toHaveLength(COLLAPSED_CARD_COUNT);
      expect(countLabel()).toBe(`sharedFolderCount:${COLLAPSED_CARD_COUNT + 7}`);
    });

    it("names the region holding the cards with the titled accordion trigger", () => {
      createComponent(children(1));

      const region = fixture.nativeElement.querySelector("[data-accordion-content]");
      const accordionTrigger = fixture.nativeElement.querySelector("[data-accordion-trigger]");

      expect(region.getAttribute("aria-labelledby")).toBe(accordionTrigger.id);
      expect(region.querySelector("a[bit-item-content]")).not.toBeNull();
    });
  });
});
