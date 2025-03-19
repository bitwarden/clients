import { CipherConfiguration } from "./cipher-configuration";

export class RegistrationStartRequest {
  constructor(
    readonly registrationRequest: string,
    readonly cipherConfiguration: CipherConfiguration,
  ) {}
}
