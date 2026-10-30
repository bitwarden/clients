import { InputSignal, Type } from "@angular/core";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { SafeInjectionToken } from "@bitwarden/ui-common";

export type SharedFolderDecoration = Type<{ collection: InputSignal<CollectionView> }>;

/**
 * Optional decoration after a shared folder's name in the shared folders list, provided as a
 * component class. `NgComponentOutlet` renders it once per row with `collection` as its one input.
 * The provider decides whether a folder gets anything (it may render nothing); the list renders it
 * on every row whenever one is provided.
 *
 * Single token: widen it to `multi` when a second feature contributes a decoration.
 */
export const SHARED_FOLDER_DECORATION = new SafeInjectionToken<SharedFolderDecoration>(
  "SharedFolderDecoration",
);
