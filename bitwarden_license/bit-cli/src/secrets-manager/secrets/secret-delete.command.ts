import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  SmOrganization,
  smBulkResponse,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class SecretDeleteCommand {
  constructor(private secretService: SecretService) {}

  async run(org: SmOrganization, secretIds: string[]): Promise<Response> {
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
    return new SecretDeleteCommand(serviceContainer.secretService);
  }
}
