import { SecretService, SecretVersionService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmSecretVersionResponse } from "../models/sm-secret-version.response";
import {
  isInSmOrganization,
  parseSmId,
  SmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

/**
 * Lists the previous values of a secret, newest first. The current value is not included.
 */
export class SecretVersionsCommand {
  constructor(
    private secretService: SecretService,
    private secretVersionService: SecretVersionService,
  ) {}

  async run(org: SmOrganization, secretId: string): Promise<Response> {
    const secret = parseSmId(secretId, "secretId");
    if (secret.error) {
      return secret.error;
    }

    try {
      const existing = await this.secretService.getBySecretId(secret.id);
      if (!isInSmOrganization(existing, org)) {
        return smNotFoundResponse("secret");
      }
      const history = await this.secretVersionService.getSecretVersions(
        org.organizationId,
        secret.id,
      );
      return Response.success(
        new ListResponse(history.versions.map((v) => new SmSecretVersionResponse(v))),
      );
    } catch (e) {
      return smErrorResponse(e, "secret");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretVersionsCommand(
      serviceContainer.secretService,
      serviceContainer.secretVersionService,
    );
  }
}
