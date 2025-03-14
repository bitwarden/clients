import { KdfType } from "@bitwarden/key-management";

import { BaseResponse } from "../../../models/response/base.response";
import { CipherConfiguration } from "../../opaque/models/cipher-configuration";
import { createKdfConfig } from "../../../../../key-management/src";

export class PreloginResponse extends BaseResponse {
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;

  opaqueConfiguration?: CipherConfiguration;

  constructor(response: any) {
    super(response);
    this.kdf = this.getResponseProperty("Kdf");
    this.kdfIterations = this.getResponseProperty("KdfIterations");
    this.kdfMemory = this.getResponseProperty("KdfMemory");
    this.kdfParallelism = this.getResponseProperty("KdfParallelism");
    this.opaqueConfiguration = this.getResponseProperty("OpaqueConfiguration");
  }

  toKdfConfig() {
    return createKdfConfig(this);
  }
}
