import { KdfType } from "../../../enums/kdfType";
import { BaseResponse } from "../../../models/response/base.response";
import { Guid } from "../../../types/guid";
import { CipherResponse } from "../../../vault/models/response/cipher.response";
import { EmergencyAccessStatusType } from "../../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../../enums/emergency-access-type";

export class EmergencyAccessGranteeDetailsResponse extends BaseResponse {
  id: Guid;
  granteeId: Guid;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.granteeId = this.getResponseProperty<Guid>("GranteeId");
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
    this.type = this.getResponseProperty("Type");
    this.status = this.getResponseProperty("Status");
    this.waitTimeDays = this.getResponseProperty("WaitTimeDays");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.avatarColor = this.getResponseProperty("AvatarColor");
  }
}

export class EmergencyAccessGrantorDetailsResponse extends BaseResponse {
  id: Guid;
  grantorId: Guid;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.grantorId = this.getResponseProperty<Guid>("GrantorId");
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
    this.type = this.getResponseProperty("Type");
    this.status = this.getResponseProperty("Status");
    this.waitTimeDays = this.getResponseProperty("WaitTimeDays");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.avatarColor = this.getResponseProperty("AvatarColor");
  }
}

export class EmergencyAccessTakeoverResponse extends BaseResponse {
  keyEncrypted: string;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;

  constructor(response: any) {
    super(response);

    this.keyEncrypted = this.getResponseProperty("KeyEncrypted");
    this.kdf = this.getResponseProperty("Kdf");
    this.kdfIterations = this.getResponseProperty("KdfIterations");
    this.kdfMemory = this.getResponseProperty("KdfMemory");
    this.kdfParallelism = this.getResponseProperty("KdfParallelism");
  }
}

export class EmergencyAccessViewResponse extends BaseResponse {
  keyEncrypted: string;
  ciphers: CipherResponse[] = [];

  constructor(response: any) {
    super(response);

    this.keyEncrypted = this.getResponseProperty("KeyEncrypted");

    const ciphers = this.getResponseProperty("Ciphers");
    if (ciphers != null) {
      this.ciphers = ciphers.map((c: any) => new CipherResponse(c));
    }
  }
}
