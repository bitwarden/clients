/**
 * Internal interface for collection access tracking.
 * Represents how a member can access a collection, either directly or via group membership.
 */
export interface CollectionAccess {
  /** Collection identifier */
  collectionId: string;
  /** Decrypted collection name */
  collectionName: string;
  /** Whether the user has read-only access */
  readOnly: boolean;
  /** Whether passwords are hidden from the user */
  hidePasswords: boolean;
  /** Whether the user can manage the collection */
  manage: boolean;
  /** Group ID if access is via group, null for direct access */
  viaGroupId: string | null;
  /** Group name if access is via group, null for direct access */
  viaGroupName: string | null;
}
