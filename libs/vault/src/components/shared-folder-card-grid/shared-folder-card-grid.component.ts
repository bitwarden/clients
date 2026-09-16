import { LiveAnnouncer } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { getNestedCollectionTree } from "@bitwarden/common/admin-console/utils/collection-utils";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import {
  IconComponent,
  IconTileComponent,
  ItemModule,
  LinkModule,
  TypographyModule,
  AccordionComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  scopedSharedFolderId,
  VaultScope,
  vaultScopeCommands,
  VaultScopeType,
} from "../../models/vault-scope";

/**
 * Three full rows stay visible before the rest collapse, however many columns the grid is currently
 * laid out in — so the cutoff is three, six, or nine cards rather than a fixed nine that spills over
 * five rows once the container drops to two columns.
 */
const MAX_COLUMNS = 3;
const VISIBLE_ROWS = 3;

/** The narrowest a track may be before the grid drops a column — the `minmax` floor below, in px. */
const MIN_CARD_WIDTH = 240;

/** The `tw-gap-3` gap applied in the template, in px. */
const GRID_GAP = 12;

/**
 * Track sizing for the card grid, kept in sync with {@link MAX_COLUMNS}, {@link MIN_CARD_WIDTH}, and
 * {@link GRID_GAP} — `1.5rem` below is the two 12px gaps that sit between three columns.
 *
 * `auto-fill` wraps cards to whatever the container can hold, and the lower bound of the `minmax`
 * caps the column count: a track can be no narrower than one third of the container (less those two
 * gaps), nor narrower than 240px. The outer `min(100%, …)` keeps a card from overflowing containers
 * narrower than 240px.
 *
 * `auto-fill` rather than `auto-fit` so the track count depends only on the container's width, never
 * on how many cards are in the grid — otherwise {@link SharedFolderCardGridComponent.columns}, which
 * decides that card count, would be measuring its own output.
 */
const GRID_TEMPLATE_COLUMNS =
  "repeat(auto-fill, minmax(min(100%, max(240px, (100% - 1.5rem) / 3)), 1fr))";

// Sentinel substituted for the child count so a fully translated sentence can be split around it,
// letting the number be emphasized in the template without embedding markup in (or splitting up)
// the translated string. Mirrors the approach in `assign-collections.component.ts`.
const COUNT_TOKEN = "\uFFFC";

// The toggle sits below the grid it controls, so `aria-controls` has to point at the list by id.
let nextId = 0;

/** A single child folder, resolved to the route its card links to. */
type SharedFolderCard = {
  id: string;
  name: string;
  commands: unknown[];
};

/**
 * Renders the direct child folders of the shared folder the {@link scope} has drilled into as a
 * responsive card grid. Each card is an anchor built from {@link vaultScopeCommands}, so click,
 * Enter, and cmd/ctrl and middle-click all behave like ordinary links.
 *
 * The component fetches nothing and has no loading state: hosts pass the collections of the vault
 * in view and the scope, and the grid derives the tree, the folder in view, and its children from
 * the two. A scope that names no folder — or names one the collections do not hold — renders
 * nothing.
 */
@Component({
  selector: "vault-shared-folder-card-grid",
  templateUrl: "./shared-folder-card-grid.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    IconComponent,
    IconTileComponent,
    ItemModule,
    LinkModule,
    NgTemplateOutlet,
    RouterLink,
    TypographyModule,
    AccordionComponent,
  ],
})
export class SharedFolderCardGridComponent {
  private readonly i18nService = inject(I18nService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  /**
   * The collections of the vault in view, narrowed to it by the host — the grid can never surface
   * a folder outside the vault it is given.
   *
   * Flat, as the collection services hold them: nesting is carried in each name, which
   * {@link collectionTree} resolves into the tree the folder in view is found in.
   */
  readonly collections = input.required<CollectionView[]>();

  /**
   * The vault the page is scoped to, and the shared folder within it the URL has drilled into. The
   * folder is what the grid renders the children of, so a scope naming none renders nothing.
   */
  readonly scope = input.required<VaultScope>();

  /** Whether the section starts open. Users can still collapse and reopen it from its header. */
  readonly open = input(true);

  /**
   * Whether the overflow cards start revealed, before the trigger below the grid has been used.
   * Reset along with {@link expanded} whenever the set of children changes.
   */
  readonly initiallyExpanded = input(false);

  protected readonly gridTemplateColumns = GRID_TEMPLATE_COLUMNS;

  /** The list the cards render into. Absent whenever the grid renders nothing. */
  private readonly gridList = viewChild<ElementRef<HTMLElement>>("gridList");

  /**
   * The width of the grid itself, in px, kept current as the window resizes. 0 until first measured.
   *
   * The grid's own width rather than the window's: it sits in a container the page sizes and pads,
   * so the two only track each other loosely, and it is the grid's width that CSS lays the columns
   * out against.
   */
  private readonly gridWidth = signal(0);

  constructor() {
    const observer = new ResizeObserver(([entry]) =>
      // `contentBoxSize` is the spec'd read; `contentRect` is the older, always-present equivalent,
      // and covers engines that hand back an empty box array.
      this.gridWidth.set(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width),
    );
    inject(DestroyRef).onDestroy(() => observer.disconnect());

    // Re-resolved rather than measured once: hosts load their collections after the first render, so
    // the list is usually absent then and arrives — or leaves again, on a drill-in to a folder with
    // no children — later.
    effect(() => {
      const list = this.gridList()?.nativeElement;
      observer.disconnect();
      if (list == null) {
        return;
      }
      // Primed here so the change-detection pass that follows already has a width, rather than
      // painting the widest layout and reflowing once the observer's first callback lands.
      this.gridWidth.set(list.clientWidth);
      observer.observe(list);
    });
  }

  /**
   * How many columns the grid is laid out in, from one to {@link MAX_COLUMNS}. Mirrors what
   * `auto-fill` resolves {@link GRID_TEMPLATE_COLUMNS} to at the measured width: no track is
   * narrower than {@link MIN_CARD_WIDTH}, so a row holds as many of those — plus the gap between
   * each pair — as fit, and the `minmax` floor growing with the container caps that at three.
   *
   * Falls back to the widest layout until the grid has been measured.
   */
  private readonly columns = computed(() => {
    const width = this.gridWidth();
    if (width === 0) {
      return MAX_COLUMNS;
    }

    const fit = Math.floor((width + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP));
    return Math.min(Math.max(fit, 1), MAX_COLUMNS);
  });

  /** The cards left on show while the grid is collapsed: three full rows at the current width. */
  private readonly collapsedCardCount = computed(() => this.columns() * VISIBLE_ROWS);

  /**
   * {@link collections} as a tree — the collections of the vault the drill-in sits inside, so the
   * grid can never surface a folder outside it.
   */
  private readonly collectionTree = computed(() => getNestedCollectionTree(this.collections()));

  private readonly sharedFolderNode = computed(() => {
    const collectionId = scopedSharedFolderId(this.scope());
    if (collectionId == null) {
      return undefined;
    }
    // Predates strict null checks: a miss comes back as `null` despite the signature.
    return ServiceUtils.getTreeNodeObjectFromList(this.collectionTree(), collectionId) ?? undefined;
  });

  /** The direct children of the shared folder in view — the cards the grid renders. */
  private readonly folders = computed(() => this.sharedFolderNode()?.children ?? []);

  /**
   * The name of the shared folder in view, titling the grid. The tree names each node by its own
   * path segment, so this is the folder's own name rather than its full path.
   */
  protected readonly parentName = computed(() => this.sharedFolderNode()?.node.name ?? "");

  protected readonly listId = `shared-folder-card-grid-list-${nextId++}`;

  /** Identifies the current set of children, so navigating between folders re-collapses the grid. */
  private readonly folderIds = computed(() =>
    this.folders()
      .map((folder) => folder.node.id)
      .join(","),
  );

  /**
   * Whether the overflow cards have been revealed. Toggled by the trigger below the grid, and reset
   * to {@link initiallyExpanded} whenever the set of children changes.
   */
  protected readonly expanded = linkedSignal({
    source: () => ({
      folderIds: this.folderIds(),
      initiallyExpanded: this.initiallyExpanded(),
    }),
    computation: ({ initiallyExpanded }) => initiallyExpanded,
  });

  /**
   * The child collections unwrapped from their tree nodes, each resolved to its own route. The tree
   * names each node by its own path segment rather than its full path, so a card shows the folder's
   * own name.
   */
  private readonly cards = computed<SharedFolderCard[]>(() =>
    this.folders().map(({ node }) => ({
      id: node.id,
      name: node.name,
      commands: this.folderRoute(node),
    })),
  );

  /**
   * The route a child folder's card links to: this vault, drilled into that folder. Following it
   * re-derives the scope and with it the grid's next set of children.
   *
   * A folder's route names the vault it lives in rather than the path taken through its ancestors,
   * so drilling deeper replaces the `:collectionId` segment rather than adding to it — see
   * {@link vaultScopeCommands}. A scope that can hold no folder links to itself, which the grid
   * never renders a card for anyway.
   */
  private folderRoute(folder: CollectionView): string[] {
    const scope = this.scope();
    return vaultScopeCommands(
      scope.type === VaultScopeType.Organization ? { ...scope, collectionId: folder.id } : scope,
    );
  }

  protected readonly count = computed(() => this.cards().length);

  /**
   * Breaks the child-count sentence into display segments so the number can be emphasized. A
   * sentinel is substituted for the count and the fully translated sentence is split around it, so
   * word order stays correct in every language and the count is always rendered as plain text
   * rather than markup.
   */
  protected readonly countSegments = computed(() => {
    const sentence = this.i18nService.t(
      this.count() === 1 ? "sharedFolderSingular" : "sharedFolderCount",
      COUNT_TOKEN,
    );

    const [before, after = ""] = sentence.split(COUNT_TOKEN);
    return { before, count: this.count(), after };
  });

  protected readonly overflowCards = computed(() => this.cards().slice(this.collapsedCardCount()));

  /**
   * The cards currently in the grid. Overflow cards are appended to the same list rather than
   * rendered in a grid of their own, so a partially filled last row is topped up before a new row
   * starts — the cutoff fills whole rows, but the children rarely run out on a row boundary.
   */
  protected readonly displayedCards = computed(() =>
    this.expanded() ? this.cards() : this.cards().slice(0, this.collapsedCardCount()),
  );

  protected toggleExpanded() {
    this.expanded.update((expanded) => !expanded);

    if (!this.expanded()) {
      return;
    }

    // The grid sits above its own trigger, so the cards that just appeared are behind the user's
    // focus and would otherwise go unnoticed by a screen reader. Only the toggle announces: a grid
    // the host renders expanded has revealed nothing, so there is nothing to point back at.
    const overflowCardsCount = this.overflowCards().length;
    const message =
      overflowCardsCount === 1
        ? this.i18nService.t("moreSharedFoldersShownAboveSingular")
        : this.i18nService.t("moreSharedFoldersShownAbove", overflowCardsCount);

    void this.liveAnnouncer.announce(message, "polite");
  }
}
