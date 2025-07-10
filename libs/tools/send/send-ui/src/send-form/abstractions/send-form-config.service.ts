import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendId } from "@bitwarden/common/types/guid";

/**
 * The mode of the add/edit form.
 * - `add` - The form is creating a new send.
 * - `edit` - The form is editing an existing send.
 * - `partial-edit` - The form is editing an existing send, but only the favorite/folder fields
 */
export type SendFormMode = "add" | "edit" | "partial-edit";

/**
 * Base configuration object for the send form. Includes all common fields.
 */
type BaseSendFormConfig = {
  /**
   * The mode of the form.
   */
  mode: SendFormMode;

  /**
   * The type of send to create/edit.
   */
  sendType: SendType;

  /**
   * Flag to indicate if the user is allowed to create sends. If false, configuration must
   * supply a list of organizations that the user can create sends in.
   */
  areSendsAllowed: boolean;

  /**
   * The original send that is being edited or cloned. This can be undefined when creating a new send.
   */
  originalSend?: Send;
};

/**
 * Configuration object for the send form when editing an existing send.
 */
type ExistingSendConfig = BaseSendFormConfig & {
  mode: "edit" | "partial-edit";
  originalSend: Send;
};

/**
 * Configuration object for the send form when creating a completely new send.
 */
type CreateNewSendConfig = BaseSendFormConfig & {
  mode: "add";
};

type CombinedAddEditConfig = ExistingSendConfig | CreateNewSendConfig;

/**
 * Configuration object for the send form when personal ownership is allowed.
 */
type SendsAllowed = CombinedAddEditConfig & {
  areSendsAllowed: true;
};

/**
 * Configuration object for the send form when Sends are not allowed by an organization.
 * Organizations must be provided.
 */
type SendsNotAllowed = CombinedAddEditConfig & {
  areSendsAllowed: false;
};

/**
 * Configuration object for the send form.
 * Determines the behavior of the form and the controls that are displayed/enabled.
 */
export type SendFormConfig = SendsAllowed | SendsNotAllowed;

/**
 * Service responsible for building the configuration object for the send form.
 */
export abstract class SendFormConfigService {
  /**
   * Builds the configuration for the send form using the specified mode, sendId, and sendType.
   * The other configuration fields will be fetched from their respective services.
   * @param mode
   * @param sendId
   * @param sendType
   */
  abstract buildConfig(
    mode: SendFormMode,
    sendId?: SendId,
    sendType?: SendType,
  ): Promise<SendFormConfig>;
}
