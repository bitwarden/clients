import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  parseSmId,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class SecretRestoreVersionCommand {
  constructor(
    private secretService: SecretService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, secretId: string, versionId: string): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
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
    return new SecretRestoreVersionCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
