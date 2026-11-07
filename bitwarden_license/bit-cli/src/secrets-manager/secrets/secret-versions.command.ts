import { SecretVersionService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmSecretVersionResponse } from "../models/sm-secret-version.response";
import { parseSmId, validateSmOrganizationAccess, smErrorResponse } from "../sm-command.utils";

/**
 * Lists the previous values of a secret, newest first. The current value is not included.
 */
export class SecretVersionsCommand {
  constructor(
    private secretVersionService: SecretVersionService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, secretId: string): Promise<Response> {
    const org = await validateSmOrganizationAccess(
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
      serviceContainer.secretVersionService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
