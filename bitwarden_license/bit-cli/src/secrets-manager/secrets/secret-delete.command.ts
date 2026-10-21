import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  resolveSmOrganization,
  smBulkResponse,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class SecretDeleteCommand {
  constructor(
    private secretService: SecretService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, secretIds: string[]): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    const parsed = parseSmIds(secretIds, "secretId");
    if (parsed.error) {
      return parsed.error;
    }

    try {
      const secrets = await this.secretService.getSecrets(org.organizationId);
      const toDelete = [];
      for (const id of parsed.ids) {
        const secret = secrets.find((s) => s.id === id);
        if (secret == null) {
          return smNotFoundResponse("secret `" + id + "`");
        }
        toDelete.push(secret);
      }

      const results = await this.secretService.delete(toDelete);
      return smBulkResponse(results, "deleted");
    } catch (e) {
      return smErrorResponse(e, "secret");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretDeleteCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
