import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

export class TrashListCommand {
  constructor(
    private secretService: SecretService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

    try {
      const secrets = await this.secretService.getTrashedSecrets(org.organizationId);
      return Response.success(new ListResponse(secrets.map((s) => new SmSecretResponse(s))));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new TrashListCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
