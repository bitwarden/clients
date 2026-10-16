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

export class SecretGetCommand {
  constructor(
    private secretService: SecretService,
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
      const view = await this.secretService.getBySecretId(secret.id);
      if (view.organizationId !== org.organizationId) {
        return smNotFoundResponse("secret");
      }
      return Response.success(new SmSecretResponse(view));
    } catch (e) {
      return smErrorResponse(e, "secret");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretGetCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
