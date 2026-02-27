import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { SendFormConfig } from "./send-form-config.service";

/**
 * Service to save the send using the correct endpoint(s) and encapsulating the logic for decrypting the send.
 *
 * This service should only be used internally by the SendFormComponent.
 */
export abstract class SendFormService {
  /**
   * Helper to decrypt a send and avoid the need to call the send service directly.
   * (useful for mocking tests/storybook).
   */
  abstract decryptSend(send: Send): Promise<SendView>;

  /**
   * Saves the new or modified send with the server.
   */
  abstract saveSend(
    send: SendView,
    file: File | ArrayBuffer,
    config: SendFormConfig,
  ): Promise<SendView>;
}
