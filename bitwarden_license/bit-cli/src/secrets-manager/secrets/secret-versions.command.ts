import { SecretVersionService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmSecretVersionResponse } from "../models/sm-secret-version.response";
import { parseSmId, SmOrganization, smErrorResponse } from "../sm-command.utils";

/**
 * Lists the previous values of a secret, newest first. The current value is not included.
 */
export class SecretVersionsCommand {
  constructor(private secretVersionService: SecretVersionService) {}

  async run(org: SmOrganization, secretId: string): Promise<Response> {
    const secret = parseSmId(secretId, "secretId");
    if (secret.error) {
      return secret.error;
    }

    try {
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
    return new SecretVersionsCommand(serviceContainer.secretVersionService);
  }
}
