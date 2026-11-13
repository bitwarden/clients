import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  isInSmOrganization,
  parseSmId,
  SmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class SecretGetCommand {
  constructor(private secretService: SecretService) {}

  async run(org: SmOrganization, secretId: string): Promise<Response> {
    const secret = parseSmId(secretId, "secretId");
    if (secret.error) {
      return secret.error;
    }

    try {
      const view = await this.secretService.getBySecretId(secret.id);
      if (!isInSmOrganization(view, org)) {
        return smNotFoundResponse("secret");
      }
      return Response.success(new SmSecretResponse(view));
    } catch (e) {
      return smErrorResponse(e, "secret");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretGetCommand(serviceContainer.secretService);
  }
}
