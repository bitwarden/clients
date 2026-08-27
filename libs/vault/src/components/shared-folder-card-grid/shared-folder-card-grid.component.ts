import { LiveAnnouncer } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  untracked,
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
 * The grid never grows past three columns, and nine cards — three full rows at that width — stay
 * visible before the rest collapse. Narrower containers fit fewer columns, so the same nine cards
 * spill over more (and a partially filled) rows.
 */
const MAX_COLUMNS = 3;
const VISIBLE_ROWS = 3;
const COLLAPSED_CARD_COUNT = MAX_COLUMNS * VISIBLE_ROWS;

/**
 * Track sizing for the card grid, kept in sync with {@link MAX_COLUMNS} and the `tw-gap-3` (0.75rem)
 * gap applied in the template.
 *
 * `auto-fill` wraps cards to whatever the container can hold, and the lower bound of the `minmax`
 * caps the column count: a track can be no narrower than one third of the container (less the two
 * gaps that sit between three columns), nor narrower than 240px. The outer `min(100%, …)` keeps a
 * card from overflowing containers narrower than 240px.
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

  protected readonly gridTemplateColumns = GRID_TEMPLATE_COLUMNS;

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

  /** Whether the overflow cards have been revealed. Toggled by the trigger below the grid. */
  protected readonly expanded = linkedSignal<string, boolean>({
    source: this.folderIds,
    computation: () => false,
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
   * A folder's route names the vault it lives in rather than the path taken to it, so drilling
   * deeper replaces the segment — see {@link vaultScopeCommands}. A scope that can hold no folder
   * links to itself, which the grid never renders a card for anyway.
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

  protected readonly overflowCards = computed(() => this.cards().slice(COLLAPSED_CARD_COUNT));

  /**
   * The cards currently in the grid. Overflow cards are appended to the same list rather than
   * rendered in a grid of their own, so a partially filled last row is topped up before a new row
   * starts — otherwise a narrower container that fits only two columns leaves a permanent gap
   * beside the ninth card.
   */
  protected readonly displayedCards = computed(() =>
    this.expanded() ? this.cards() : this.cards().slice(0, COLLAPSED_CARD_COUNT),
  );

  protected toggleExpanded() {
    this.expanded.update((expanded) => !expanded);
  }

  constructor() {
    effect(() => {
      if (!this.expanded()) {
        return;
      }

      // The grid sits above its own trigger, so the cards that just appeared are behind the user's
      // focus and would otherwise go unnoticed by a screen reader.
      const message = untracked(() => {
        const overflowCardsCount = this.overflowCards().length;
        if (overflowCardsCount === 1) {
          return this.i18nService.t("moreSharedFoldersShownAboveSingular");
        }
        return this.i18nService.t("moreSharedFoldersShownAbove", overflowCardsCount);
      });

      void this.liveAnnouncer.announce(message, "polite");
    });
  }
}
