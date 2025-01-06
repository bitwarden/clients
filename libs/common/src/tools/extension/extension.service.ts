import { StateProvider } from "@bitwarden/common/platform/state";

import { LegacyEncryptorProvider } from "../cryptography/legacy-encryptor-provider";

import { ExtensionRegistry } from "./extension-registry.abstraction";

export class ExtensionService {
  constructor(
    private readonly registry: ExtensionRegistry,
    private readonly stateProvider: StateProvider,
    private readonly encryptorProvider: LegacyEncryptorProvider,
  ) {}

  // TODO: implement the service
}
