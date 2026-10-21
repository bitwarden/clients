import { ServiceAccountEventLogApiService } from "@bitwarden/bit-common/secrets-manager/service-accounts/event-logs/service-account-event-log-api.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventResponse } from "@bitwarden/common/dirt/event-logs";

import { ServiceContainer } from "../../service-container";
import { resolveSmMachineAccountId } from "../access-tokens/sm-access-token.utils";
import { SmEventResponse } from "../models/sm-event.response";
import { resolveSmOrganization, smErrorResponse } from "../sm-command.utils";

export type EventsOptions = {
  machineAccountId: string;
  start: string;
  end: string;
};

export class EventsCommand {
  constructor(
    private serviceAccountEventLogApiService: ServiceAccountEventLogApiService,
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, options: EventsOptions): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    const start = this.parseDate(options.start, "start");
    if (start instanceof Response) {
      return start;
    }
    const end = this.parseDate(options.end, "end");
    if (end instanceof Response) {
      return end;
    }
    if (start > end) {
      return Response.badRequest("`start` must be before `end`.");
    }

    const machineAccount = await resolveSmMachineAccountId(
      this.serviceAccountService,
      org.organizationId,
      options.machineAccountId,
    );
    if (machineAccount.error) {
      return machineAccount.error;
    }

    try {
      const events: EventResponse[] = [];
      let continuationToken: string | undefined;
      do {
        const page = await this.serviceAccountEventLogApiService.getEvents(
          machineAccount.machineAccountId,
          start.toISOString(),
          end.toISOString(),
          continuationToken,
        );
        events.push(...page.data);
        continuationToken = page.continuationToken ?? undefined;
      } while (continuationToken);

      return Response.success(new ListResponse(events.map((e) => new SmEventResponse(e))));
    } catch (e) {
      return smErrorResponse(e, "machine account");
    }
  }

  private parseDate(value: string | undefined, label: string): Date | Response {
    if (value == null || value === "") {
      return Response.badRequest("`" + label + "` is required.");
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return Response.badRequest("`" + value + "` is not a valid date for `" + label + "`.");
    }
    return date;
  }

  static create(serviceContainer: ServiceContainer) {
    return new EventsCommand(
      serviceContainer.serviceAccountEventLogApiService,
      serviceContainer.serviceAccountService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
