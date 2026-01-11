// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LoginDecryptionOptionsService } from "./login-decryption-options.service";

export class DefaultLoginDecryptionOptionsService implements LoginDecryptionOptionsService {
  constructor() {}

  handleCreateUserSuccess(): Promise<void | null> {
    return null;
  }
}
