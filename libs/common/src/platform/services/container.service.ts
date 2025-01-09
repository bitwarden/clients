import { KeyService } from "../../../../key-management/src/abstractions/key.service";
import { EncryptService } from "../abstractions/encrypt.service";

export class ContainerService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
  ) {}

  attachToGlobal(global: any) {
    if (!global.bitwardenContainerService) {
      global.bitwardenContainerService = this;
    }
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
