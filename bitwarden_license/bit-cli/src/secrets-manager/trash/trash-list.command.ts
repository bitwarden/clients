import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

export class TrashListCommand {
  constructor(private secretService: SecretService) {}

  async run(org: SmOrganization): Promise<Response> {
    try {
      const secrets = await this.secretService.getTrashedSecrets(org.organizationId);
      return Response.success(new ListResponse(secrets.map((s) => new SmSecretResponse(s))));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new TrashListCommand(serviceContainer.secretService);
  }
}
