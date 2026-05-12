import { Observable } from "rxjs";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

export const AddAccessStatusType = Object.freeze({
  All: 0,
  AddAccess: 1,
} as const);
export type AddAccessStatusType = (typeof AddAccessStatusType)[keyof typeof AddAccessStatusType];

export abstract class VaultCollectionService {
  /** All collections in the organization, excluding the "Unassigned" virtual collection. */
  abstract readonly allCollectionsWithoutUnassigned$: Observable<CollectionAdminView[]>;

  /** All collections in the organization, including the "Unassigned" virtual collection. */
  abstract readonly allCollections$: Observable<CollectionAdminView[]>;

  /**
   * Collections the user can assign items to and edit within.
   * Users who can edit all ciphers can implicitly access any collection; others only see assigned ones.
   */
  abstract readonly editableCollections$: Observable<CollectionAdminView[]>;

  /** Filtered and searched list of collections displayed in the vault UI. */
  abstract readonly collections$: Observable<CollectionAdminView[]>;

  /** The currently selected collection node, based on the active filter. */
  abstract readonly selectedCollection$: Observable<TreeNode<CollectionAdminView> | undefined>;

  /** Whether the collection access-restricted banner should be shown. */
  abstract readonly showCollectionAccessRestricted$: Observable<boolean>;

  /** Whether the "Add Access" filter toggle should be shown. */
  abstract readonly showAddAccessToggle$: Observable<boolean>;

  /** Current add-access filter state. */
  abstract readonly addAccessStatus$: Observable<AddAccessStatusType>;

  /** Updates the add-access filter state. */
  abstract setAddAccessStatus(status: AddAccessStatusType): void;

  /** Forces a re-fetch of collections from the API. */
  abstract reload(): void;
}
