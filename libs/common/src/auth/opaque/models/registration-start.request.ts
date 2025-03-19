import { OpaqueCipherConfiguration } from "./opaque-cipher-configuration";

export class RegistrationStartRequest {
  constructor(
    readonly registrationRequest: string,
    readonly cipherConfiguration: OpaqueCipherConfiguration,
  ) {}
}
