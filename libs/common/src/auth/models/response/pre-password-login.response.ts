import { KdfType, createKdfConfig } from "@bitwarden/key-management";

import { BaseResponse } from "../../../models/response/base.response";
import { OpaqueCipherConfiguration } from "../../opaque/models/opaque-cipher-configuration";

export class PrePasswordLoginResponse extends BaseResponse {
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;

  opaqueConfiguration?: OpaqueCipherConfiguration;

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
