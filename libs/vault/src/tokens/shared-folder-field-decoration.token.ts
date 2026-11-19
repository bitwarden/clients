import { InputSignal, Type } from "@angular/core";
import { Observable } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SelectItemView } from "@bitwarden/components";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The presentation a provider may add to one shared folder's option and chip: the icon and tile,
 * and text that replaces the folder's name in the option (`listName`, which the field's typeahead
 * also matches against) and on the chip (`labelName`). Already localized. The option's value, the
 * folder's id, is never affected.
 */
export type SharedFolderOptionDecoration = Partial<
  Pick<SelectItemView, "icon" | "iconTile" | "listName" | "labelName">
>;

/** Decorates one shared folder; `undefined` leaves that folder plain. */
export type SharedFolderOptionDecorator = (
  collection: CollectionView,
) => SharedFolderOptionDecoration | undefined;

/** One of the item's current shared folders, with the name the field shows for it. */
export interface SharedFolderFieldFolder {
  readonly collection: CollectionView;
  /** The folder's display name, the same text its option and chip show. Already localized. */
  readonly name: string;
}

/** A component rendered under the field, handed the item's current shared folders. */
export interface SharedFolderFieldHint {
  readonly folders: InputSignal<SharedFolderFieldFolder[]>;
}

/**
 * Optional decoration of the cipher form's "Shared folders" (collections) field: extra presentation
 * on each option and selected chip, plus a hint under the field. The vault never interprets either;
 * the provider decides which folders get anything.
 */
export interface SharedFolderFieldDecoration {
  /**
   * The decorator for `organization`'s folders, or `null` to leave the field plain. Read once each
   * time the field's options are built, so it must emit.
   */
  decorator$(organization: Organization): Observable<SharedFolderOptionDecorator | null>;

  /**
   * Rendered inside the field's hint slot while `decorator$` emits a decorator for the selected
   * organization, so it needs no gating of its own. It may render nothing, and it owns its own
   * live-region semantics.
   */
  readonly hint: Type<SharedFolderFieldHint>;
}

export const SHARED_FOLDER_FIELD_DECORATION = new SafeInjectionToken<SharedFolderFieldDecoration>(
  "SharedFolderFieldDecoration",
);
