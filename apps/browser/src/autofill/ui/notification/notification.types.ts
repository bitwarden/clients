import type { NotificationCipherData } from "../../content/components/cipher/types";
import type { CollectionView, FolderView, OrgView } from "../../content/components/common-types";
import type {
  NotificationTaskInfo,
  NotificationTypes,
} from "../../notification/abstractions/notification-bar";

export type NotificationCipher = NotificationCipherData;
export type OrganizationCategory = NonNullable<
  NotificationCipherData["organizationCategories"]
>[number];
export type { CollectionView, FolderView, OrgView };

/** Prompt to save a new login, update an existing one, or unlock so a save can happen. */
export type NotificationBarSaveState = {
  view:
    | typeof NotificationTypes.Add
    | typeof NotificationTypes.Change
    | typeof NotificationTypes.Unlock;
  ciphers?: NotificationCipher[];
  organizations?: OrgView[];
  folders?: FolderView[];
  collections?: CollectionView[];
  /** False when an organization policy removes the personal vault option. */
  personalVaultAllowed?: boolean;
  loading?: boolean;
};

/** Result of a save or update attempt. */
export type NotificationBarConfirmationState = {
  view: "confirmation";
  /** The kind of save that was attempted. */
  type: typeof NotificationTypes.Add | typeof NotificationTypes.Change;
  itemName: string;
  /** Set when the save failed. */
  error?: string;
  task?: NotificationTaskInfo;
};

/** Warns that the password just used is flagged at-risk by an organization. */
export type NotificationBarAtRiskPasswordState = {
  view: typeof NotificationTypes.AtRiskPassword;
  organizationName: string;
  /** When false, the user is told to change the password on the site themselves. */
  passwordChangeUri: boolean;
};

export type NotificationBarState =
  NotificationBarSaveState | NotificationBarConfirmationState | NotificationBarAtRiskPasswordState;

/** Selections made in the save footer, emitted with the save action. */
export type NotificationSaveSelection = {
  /** Organization id, or `"0"` for the personal vault. */
  vault: string;
  /** Folder id, or `"0"` for no folder. */
  folder: string;
  /** Collection id, or `"0"` for no collection. */
  collection: string;
};
