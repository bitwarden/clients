import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  parseSmId,
  SmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class SecretRestoreVersionCommand {
  constructor(private secretService: SecretService) {}

  async run(org: SmOrganization, secretId: string, versionId: string): Promise<Response> {
    const secret = parseSmId(secretId, "secretId");
    if (secret.error) {
      return secret.error;
    }
    const version = parseSmId(versionId, "versionId");
    if (version.error) {
      return version.error;
    }

    try {
      const existing = await this.secretService.getBySecretId(secret.id);
      if (existing.organizationId !== org.organizationId) {
        return smNotFoundResponse("secret");
      }
      if (!existing.write) {
        return Response.noEditPermission();
      }
    } catch (e) {
      return smErrorResponse(e, "secret");
    }

    try {
      const restored = await this.secretService.restoreVersion(secret.id, version.id);
      return Response.success(new SmSecretResponse(restored));
    } catch (e) {
      return smErrorResponse(e, "secret version");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretRestoreVersionCommand(serviceContainer.secretService);
  }
}
