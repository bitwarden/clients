import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { BitwardenIcon } from "@bitwarden/components";

/**
 * A client-supplied action for a row's overflow menu.
 *
 * The action carries an event **factory** rather than an event, so the shared table never
 * constructs a domain event itself — each client decides what its actions mean. `label` is
 * already translated for the same reason
 *
 * @example
 * ```ts
 * protected readonly rowActions = computed<VaultItemsTableRowAction<CipherView, VaultItemEvent<CipherView>>[]>(() => [
 *   {
 *     id: "edit",
 *     label: this.i18nService.t("edit"),
 *     icon: "bwi-pencil-square",
 *     event: (item) => ({ type: "editCipher", item }),
 *   },
 * ]);
 * ```
 */
export type VaultItemsTableRowAction<C extends CipherViewLike, E> = {
  /** Stable identifier. Drives the menu item's QA id and the `@for` track expression. */
  id: string;

  /** Already-translated label. */
  label: string;

  icon: BitwardenIcon;

  /** Builds the event emitted when this action is chosen for `item`. */
  event: (item: C) => E;

  /** Whether the action shows for `item`. Omit for always-shown. */
  show?: (item: C) => boolean;

  /**
   * Whether the action is gated behind a premium upgrade for `item` — Archive, for one, is only
   * available to premium users. When it returns `true` the menu item carries the Upgrade badge and
   * choosing it opens the upgrade prompt instead of emitting {@link event}; the client decides who
   * counts as gated, so the table never inspects the user's plan itself.
   *
   * Omit for actions that are never gated.
   */
  premiumGated?: (item: C) => boolean;

  /** Menu item styling, passed straight to `bitMenuItem`. Defaults to `"primary"`. */
  variant?: "primary" | "danger";
};
