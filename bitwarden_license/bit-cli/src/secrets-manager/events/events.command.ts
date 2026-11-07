import { ServiceAccountEventLogApiService, ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { EventResponse } from "@bitwarden/common/dirt/event-logs";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceContainer } from "../../service-container";
import { resolveSmMachineAccountId } from "../access-tokens/sm-access-token.utils";
import { SmEventResponse } from "../models/sm-event.response";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

export type EventsOptions = {
  machineAccountId: string;
  start: string;
  end: string;
};

export class EventsCommand {
  constructor(
    private serviceAccountEventLogApiService: ServiceAccountEventLogApiService,
    private serviceAccountService: ServiceAccountService,
  ) {}

  async run(org: SmOrganization, options: EventsOptions): Promise<Response> {
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
    if (Utils.isNullOrWhitespace(value)) {
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
    );
  }
}
