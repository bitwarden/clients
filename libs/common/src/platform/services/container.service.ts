// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "../abstractions/config/config.service";

export class ContainerService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private configService?: ConfigService,
  ) {}

  attachToGlobal(global: any) {
    if (!global.bitwardenContainerService) {
      global.bitwardenContainerService = this;
    }
  }

  /**
   * Enables the local feature flag override GUI on this client. Intended to be invoked from the
   * developer console: `bitwardenContainerService.enableFeatureFlagGui()`.
   * @throws Will throw if ConfigService was not provided to the ContainerService constructor
   */
  enableFeatureFlagGui(): Promise<void> {
    if (this.configService == null) {
      throw new Error("ContainerService.configService not initialized.");
    }
    return this.configService.setLocalFeatureFlagOverrideGuiEnabled(true);
  }

  /**
   * @throws Will throw if KeyService was not instantiated and provided to the ContainerService constructor
   */
  getKeyService(): KeyService {
    if (this.keyService == null) {
      throw new Error("ContainerService.keyService not initialized.");
    }
    return this.keyService;
  }

  /**
   * @throws Will throw if EncryptService was not instantiated and provided to the ContainerService constructor
   */
  getEncryptService(): EncryptService {
    if (this.encryptService == null) {
      throw new Error("ContainerService.encryptService not initialized.");
    }
    return this.encryptService;
  }
}
