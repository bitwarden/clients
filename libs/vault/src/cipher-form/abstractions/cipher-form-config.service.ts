import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

/**
 * The mode of the add/edit form.
 * - `add` - The form is creating a new cipher.
 * - `edit` - The form is editing an existing cipher.
 * - `partial-edit` - The form is editing an existing cipher, but only the favorite/folder fields
 * - `clone` - The form is creating a new cipher that is a clone of an existing cipher.
 */
export type CipherFormMode = "add" | "edit" | "partial-edit" | "clone";

/**
 * Optional initial values for the form.
 */
export type OptionalInitialValues = {
  folderId?: string;
  organizationId?: OrganizationId;
  collectionIds?: CollectionId[];
  loginUri?: string;
};

/**
 * Base configuration object for the cipher form. Includes all common fields.
 */
type BaseCipherFormConfig = {
  /**
   * The mode of the form.
   */
  mode: CipherFormMode;

  /**
   * The type of cipher to create/edit.
   */
  cipherType: CipherType;

  /**
   * Flag to indicate the form should submit to admin endpoints that have different permission checks. If the
   * user is not an admin or performing an action that requires admin permissions, this should be false.
   */
  admin: boolean;

  /**
   * Flag to indicate if the user is allowed to create ciphers in their own Vault. If false, configuration must
   * supply a list of organizations that the user can create ciphers in.
   */
  allowPersonalOwnership: boolean;

  /**
   * The original cipher that is being edited or cloned. This can be undefined when creating a new cipher.
   */
  originalCipher?: Cipher;

  /**
   * Optional initial values for the form when creating a new cipher. Useful when creating a cipher in a filtered view.
   */
  initialValues?: OptionalInitialValues;

  /**
   * The list of collections that the user has visibility to. This list should include read-only collections as they
   * can still be displayed in the component for reference.
   */
  collections: CollectionView[];

  /**
   * The list of folders for the current user. Should include the "No Folder" option with a `null` id.
   */
  folders: FolderView[];

  /**
   * List of organizations that the user can create ciphers for.
   */
  organizations?: Organization[];
};

/**
 * Configuration object for the cipher form when editing/cloning an existing cipher.
 */
type ExistingCipherConfig = BaseCipherFormConfig & {
  mode: "edit" | "partial-edit" | "clone";
  originalCipher: Cipher;
};

/**
 * Configuration object for the cipher form when creating a completely new cipher.
 */
type CreateNewCipherConfig = BaseCipherFormConfig & {
  mode: "add";
};

type CombinedAddEditConfig = ExistingCipherConfig | CreateNewCipherConfig;

/**
 * Configuration object for the cipher form when personal ownership is allowed.
 */
type PersonalOwnershipAllowed = CombinedAddEditConfig & {
  allowPersonalOwnership: true;
};

/**
 * Configuration object for the cipher form when personal ownership is not allowed.
 * Organizations must be provided.
 */
type PersonalOwnershipNotAllowed = CombinedAddEditConfig & {
  allowPersonalOwnership: false;
  organizations: Organization[];
};

/**
 * Configuration object for the cipher form.
 * Determines the behavior of the form and the controls that are displayed/enabled.
 */
export type CipherFormConfig = PersonalOwnershipAllowed | PersonalOwnershipNotAllowed;

/**
 * Service responsible for building the configuration object for the cipher form.
 */
export abstract class CipherFormConfigService {
  /**
   * Builds the configuration for the cipher form using the specified mode, cipherId, and cipherType.
   * The other configuration fields will be fetched from their respective services.
   * @param mode
   * @param cipherId
   * @param cipherType
   */
  abstract buildConfig(
    mode: CipherFormMode,
    cipherId?: CipherId,
    cipherType?: CipherType,
  ): Promise<CipherFormConfig>;
}
