import { AccessService } from "@bitwarden/bit-common/secrets-manager/service-accounts/access/access.service";
import { AccessTokenView } from "@bitwarden/bit-common/secrets-manager/service-accounts/models/view/access-token.view";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { StringResponse } from "@bitwarden/cli/models/response/string.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmAccessTokenCreatedResponse } from "../models/sm-access-token.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

import { resolveSmMachineAccountId } from "./sm-access-token.utils";

const MAX_NAME_LENGTH = 80;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const NO_EXPIRY_VALUES = ["never", "none"];

export type AccessTokenCreateOptions = {
  name?: string;
  expires?: string;
  raw?: boolean;
};

export class AccessTokenCreateCommand {
  constructor(
    private accessService: AccessService,
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(
    organizationId: string,
    machineAccountId: string,
    options: AccessTokenCreateOptions,
  ): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

    const name = options.name?.trim();
    if (name == null || name === "") {
      return Response.badRequest("`name` is required.");
    }
    if (name.length > MAX_NAME_LENGTH) {
      return Response.badRequest("`name` must be at most " + MAX_NAME_LENGTH + " characters.");
    }
    const expireAt = this.parseExpires(options.expires);
    if (expireAt instanceof Response) {
      return expireAt;
    }

    const machineAccount = await resolveSmMachineAccountId(
      this.serviceAccountService,
      org.organizationId,
      machineAccountId,
    );
    if (machineAccount.error) {
      return machineAccount.error;
    }

    const view = new AccessTokenView();
    view.name = name;
    view.expireAt = expireAt;

    let accessToken: string;
    try {
      accessToken = await this.accessService.createAccessToken(
        org.organizationId,
        machineAccount.machineAccountId,
        view,
      );
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }

    if (options.raw) {
      return Response.success(new StringResponse(accessToken));
    }
    return Response.success(
      new SmAccessTokenCreatedResponse(
        AccessTokenCreateCommand.getAccessTokenId(accessToken),
        machineAccount.machineAccountId,
        name,
        expireAt,
        accessToken,
      ),
    );
  }

  private parseExpires(expires: string | undefined): Date | null | Response {
    if (expires == null || expires === "" || NO_EXPIRY_VALUES.includes(expires.toLowerCase())) {
      return null;
    }
    if (!ISO_DATE_PATTERN.test(expires)) {
      return Response.badRequest(
        "`expires` must be `never`, `none`, or an ISO 8601 date, e.g. 2026-12-31 or 2026-12-31T23:59:59Z.",
      );
    }
    const date = new Date(expires);
    if (isNaN(date.getTime())) {
      return Response.badRequest("`expires` is not a valid date.");
    }
    if (date.getTime() <= Date.now()) {
      return Response.badRequest("`expires` must be in the future.");
    }
    return date;
  }

  /**
   * Access tokens have the form `<version>.<id>.<clientSecret>:<encryptionKey>`.
   */
  private static getAccessTokenId(accessToken: string): string {
    return accessToken.split(":")[0].split(".")[1];
  }

  static create(serviceContainer: ServiceContainer) {
    return new AccessTokenCreateCommand(
      serviceContainer.accessService,
      serviceContainer.serviceAccountService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
