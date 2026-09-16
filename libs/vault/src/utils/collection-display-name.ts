import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/**
 * The name to show for a collection anywhere its name is rendered.
 *
 * A collection whose name failed to decrypt carries a raw, untranslated placeholder instead of a
 * name, so every surface renders the same localized error text in its place. Such collections are
 * still listed rather than hidden: their items are encrypted independently and are unaffected, and
 * the collection pickers write their selection back wholesale, so dropping an entry would unassign
 * the cipher from it. Selection is keyed by collection id and never by this label, so an entry the
 * user does not touch round-trips unchanged.
 *
 * The remedy is to re-name the collection, which re-encrypts it with the current organization key.
 * That is offered from the collection's row and its edit dialog, not from a picker.
 */
export function collectionDisplayName(
  collection: Pick<CollectionView, "name" | "decryptionFailure">,
  i18nService: I18nService,
): string {
  return collection.decryptionFailure ? i18nService.t("errorCannotDecrypt") : collection.name;
}
