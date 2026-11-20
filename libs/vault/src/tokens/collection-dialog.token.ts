import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

/** Which tab the collection dialog opens on. */
export const CollectionDialogTab = Object.freeze({
  Info: "info",
  Access: "access",
} as const);
export type CollectionDialogTab = (typeof CollectionDialogTab)[keyof typeof CollectionDialogTab];

/** What the reader did with the dialog, once it has closed and its result has been persisted. */
export const CollectionDialogOutcome = Object.freeze({
  Saved: "saved",
  Deleted: "deleted",
  Canceled: "canceled",
} as const);
export type CollectionDialogOutcome =
  (typeof CollectionDialogOutcome)[keyof typeof CollectionDialogOutcome];

export interface CollectionDialogOpenParams {
  organizationId: OrganizationId;

  /** The collection to edit. Omit to create one. */
  collectionId?: CollectionId;

  /** Which tab to open on. Omit for the implementation's own default. */
  initialTab?: CollectionDialogTab;
}

/**
 * Opens the client's create/edit collection dialog, and writes whatever it returns back to
 * `CollectionService` so any stream over the collections re-emits with the change.
 *
 * Only the web client has this dialog, so it's reached through a token rather than imported: a
 * client that provides none lists its collections read-only.
 */
export interface CollectionDialogRef {
  open(params: CollectionDialogOpenParams): Promise<CollectionDialogOutcome>;
}

export const COLLECTION_DIALOG = new SafeInjectionToken<CollectionDialogRef>("COLLECTION_DIALOG");
