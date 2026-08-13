import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  IconButtonModule,
  IconModule,
  MenuModule,
  TableDef,
  SkeletonTextComponent,
  BitCellLoadingDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultItemCopyActionsComponent } from "../item-copy-actions/item-copy-actions.component";

import {
  DEFAULT_COPY_PRESENTATION,
  VaultItemsTableCopyPresentation,
} from "./vault-items-table-copy-presentation";
import { VaultItemsTableRowAction } from "./vault-items-table-row-action";
import type { VaultItemsTableColumn } from "./vault-items-table.component";

/**
 * The trailing actions column for a vault items table, in two tiers:
 *
 * 1. **Built-in quick actions** — Launch and Copy, revealed on row hover/focus.
 * 2. **The client-specific overflow menu** — always visible, built from {@link rowActions}. An
 *    action the client reports as `premiumGated` for a row renders the Upgrade badge and opens
 *    the upgrade prompt instead of emitting.
 *
 * Every control lives in `<bit-cell>`'s `end` slot. The cell's middle element is `flex-grow`,
 * so the end slot is pushed hard right — which anchors the overflow trigger to the same
 * position on every row no matter how many quick actions that row reveals, and keeps the
 * revealed strip inside this column's own track instead of overlaying its neighbor.
 */
@Component({
  selector: "vault-items-table-actions-column",
  templateUrl: "./vault-items-table-actions-column.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    I18nPipe,
    IconButtonModule,
    IconModule,
    MenuModule,
    PremiumBadgeComponent,
    VaultItemCopyActionsComponent,
    SkeletonTextComponent,
  ],
})
export class VaultItemsTableActionsColumnComponent<C extends CipherViewLike, E> {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  /** The host table's definition, for typed `*bitCellDef` references. */
  readonly table = input.required<TableDef<C, VaultItemsTableColumn>>();

  /** The client's overflow menu actions, in display order. */
  readonly rowActions = input<VaultItemsTableRowAction<C, E>[]>([]);

  /** How the built-in Copy quick action presents itself. */
  readonly copyPresentation = input<VaultItemsTableCopyPresentation>(DEFAULT_COPY_PRESENTATION);

  /** Emits the event a chosen row action built. */
  readonly action = output<E>();

  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;

  /**
   * Grid track for this column, sized to the widest set the current configuration can reveal.
   *
   * The `end` group is right-anchored, so it absorbs per-row variance (a row with no launchable
   * URI reveals one fewer button) without moving the overflow trigger — but only while the
   * content fits. Overflow pushes the whole group rightward and the trigger falls out of
   * alignment with every other row, so this slack is load-bearing, not cosmetic.
   *
   * Budget is 32px per button, 8px per gap, 16px cell padding each side, plus the 8px gap the
   * cell puts before its `end` group:
   * - collapsed — Launch + Copy + trigger: `3*32 + 2*8 + 32 + 8` = 152, rounded to 160px.
   * - expanded — Launch + 3 copy buttons + trigger: `5*32 + 4*8 + 32 + 8` = 232, rounded to 240px.
   */
  protected readonly columnWidth = computed(() =>
    this.copyPresentation() === "expanded" ? "240px" : "160px",
  );

  /** Whether Copy renders one button per field rather than a single button with a menu. */
  protected readonly expandedCopy = computed(() => this.copyPresentation() === "expanded");

  /**
   * Reveal chrome for the quick action strip: transparent until the row is hovered or contains
   * focus, and pinned open while one of its menus is expanded (a menu moves focus into an
   * overlay outside the row, so `:focus-visible` no longer matches here). `group/row` is
   * provided by `bit-row` for exactly this purpose.
   */
  protected readonly revealClasses =
    "tw-flex tw-flex-nowrap tw-items-center tw-gap-2 tw-opacity-0 tw-transition-opacity" +
    " tw-pointer-events-none group-hover/row:tw-opacity-100 group-hover/row:tw-pointer-events-auto" +
    " group-has-[:focus-visible]/row:tw-opacity-100" +
    " group-has-[:focus-visible]/row:tw-pointer-events-auto" +
    " [&:has([aria-expanded='true'])]:tw-opacity-100" +
    " [&:has([aria-expanded='true'])]:tw-pointer-events-auto";

  /** The actions visible for `item`, honouring each action's optional `show` predicate. */
  protected visibleActions(item: C): VaultItemsTableRowAction<C, E>[] {
    return this.rowActions().filter((action) => action.show?.(item) ?? true);
  }

  /**
   * Opens the item's launch URI, recording the launch first so "last launched" ordering stays
   * accurate. Delegates the open to `PlatformUtilsService` rather than `window.open` so each
   * client (web tab, Electron shell) handles it natively.
   */
  protected async launch(item: C): Promise<void> {
    const uri = CipherViewLikeUtils.getLaunchUri(item);
    if (!uri) {
      return;
    }

    if (item.id) {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.updateLastLaunchedDate(item.id as CipherId, userId);
    }

    this.platformUtilsService.launchUri(uri);
  }
}
