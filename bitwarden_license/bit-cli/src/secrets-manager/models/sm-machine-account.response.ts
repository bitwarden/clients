import {
  ServiceAccountSecretsDetailsView,
  ServiceAccountView,
} from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmMachineAccountResponse implements BaseResponse {
  object = "sm-machine-account";

  id: string;
  organizationId: string;
  name: string;
  creationDate: string;
  revisionDate: string;
  accessToSecrets?: number;
  decryptionError: boolean;

  constructor(machineAccount: ServiceAccountView | ServiceAccountSecretsDetailsView) {
    this.id = machineAccount.id;
    this.organizationId = machineAccount.organizationId;
    this.name = machineAccount.name;
    this.creationDate = machineAccount.creationDate;
    this.revisionDate = machineAccount.revisionDate;
    if (machineAccount instanceof ServiceAccountSecretsDetailsView) {
      this.accessToSecrets = machineAccount.accessToSecrets;
    }
    this.decryptionError = machineAccount.decryptionError;
  }
}
