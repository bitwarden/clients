import { SecretVersionService } from "@bitwarden/bit-common/secrets-manager/secrets/secret-version.service";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmSecretVersionResponse } from "../models/sm-secret-version.response";
import {
  parseSmId,
  resolveSmOrganization,
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
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, secretId: string): Promise<Response> {
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

    try {
      const existing = await this.secretService.getBySecretId(secret.id);
      if (existing.organizationId !== org.organizationId) {
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
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
