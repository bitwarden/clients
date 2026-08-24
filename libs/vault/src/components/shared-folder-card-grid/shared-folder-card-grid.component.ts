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
import { toSignal } from "@angular/core/rxjs-interop";
import { Params, QueryParamsHandling, RouterLink } from "@angular/router";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import {
  IconComponent,
  IconTileComponent,
  ItemModule,
  LinkModule,
  TypographyModule,
  AccordionComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RoutedVaultFilterModel } from "../../models/routed-vault-filter.model";
import { RoutedVaultFilterService } from "../../services/routed-vault-filter.service";

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
  queryParams?: Params | null;
  queryParamsHandling?: QueryParamsHandling | null;
  state?: Record<string, unknown>;
};

/**
 * Renders the direct child folders of the shared folder currently in view as a responsive card
 * grid. Each card is an anchor built from the host-provided {@link RoutedVaultFilterService}, so
 * activation, middle-click, and right-click all behave like ordinary links.
 *
 * The component is presentational: it fetches nothing and has no loading state. Hosts pass the
 * children they have already derived, and an empty list renders nothing.
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
  private readonly routedVaultFilterService = inject(RoutedVaultFilterService);

  /**
   * Direct children of the shared folder in view, as already derived by the host. An empty array
   * renders nothing.
   */
  readonly folders = input.required<TreeNode<CollectionView>[]>();

  /** Name of the shared folder in view, used to title the section. */
  readonly parentName = input.required<string>();

  protected readonly gridTemplateColumns = GRID_TEMPLATE_COLUMNS;

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

  private readonly filter = toSignal(this.routedVaultFilterService.filter$, {
    initialValue: {} as RoutedVaultFilterModel,
  });

  private readonly cards = computed<SharedFolderCard[]>(() => {
    const filter = this.filter();

    return this.folders().map((child) => {
      // Mirrors how the vault filter selects a collection: keep the surrounding filter, swap in the
      // child, and clear the filters that cannot apply alongside it.
      const [commands, extras] = this.routedVaultFilterService.createRoute({
        ...filter,
        collectionId: child.node.id as CollectionId,
        folderId: undefined,
        type: undefined,
      });

      return {
        id: child.node.id,
        name: child.node.name,
        commands,
        queryParams: extras?.queryParams,
        queryParamsHandling: extras?.queryParamsHandling,
        state: extras?.state,
      };
    });
  });

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
