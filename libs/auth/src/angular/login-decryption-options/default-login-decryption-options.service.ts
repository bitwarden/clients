// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { LoginDecryptionOptionsService } from "./login-decryption-options.service";

export class DefaultLoginDecryptionOptionsService implements LoginDecryptionOptionsService {
  constructor(protected messagingService: MessagingService) {}

  handleCreateUserSuccess(): Promise<void | null> {
    return null;
  }

  async logOut(): Promise<void> {
    this.messagingService.send("logout");
  }
}
