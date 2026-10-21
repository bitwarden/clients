import { mock } from "jest-mock-extended";

import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { ServiceAccountEventLogApiService } from "@bitwarden/bit-common/secrets-manager/service-accounts/event-logs/service-account-event-log-api.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { ListResponse as CliListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventResponse, EventType } from "@bitwarden/common/dirt/event-logs";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { SmEventResponse } from "../models/sm-event.response";
import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { EventsCommand } from "./events.command";

describe("EventsCommand", () => {
  const eventLogApiService = mock<ServiceAccountEventLogApiService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  const secretId = "33333333-3333-3333-3333-333333333333";
  let command: EventsCommand;

  const options = (overrides: Record<string, string> = {}) => ({
    machineAccountId,
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-02-01T00:00:00.000Z",
    ...overrides,
  });

  const page = (types: EventType[], continuationToken: string | null) =>
    new ListResponse(
      {
        Data: types.map((Type) => ({
          Type,
          Date: "2026-01-15T00:00:00.000Z",
          ServiceAccountId: machineAccountId,
          SecretId: secretId,
        })),
        ContinuationToken: continuationToken,
      },
      EventResponse,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), { id: machineAccountId, organizationId: smOrgId }),
    );
    command = new EventsCommand(
      eventLogApiService,
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("returns events across all pages", async () => {
    eventLogApiService.getEvents
      .mockResolvedValueOnce(page([EventType.Secret_Retrieved], "next"))
      .mockResolvedValueOnce(page([EventType.Secret_Edited], null));

    const response = await command.run(smOrgId, options());

    expect(response.success).toBe(true);
    expect(eventLogApiService.getEvents).toHaveBeenNthCalledWith(
      1,
      machineAccountId,
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      undefined,
    );
    expect(eventLogApiService.getEvents).toHaveBeenNthCalledWith(
      2,
      machineAccountId,
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00.000Z",
      "next",
    );
    const data = (response.data as CliListResponse).data as SmEventResponse[];
    expect(data.map((e) => e.typeName)).toEqual(["Secret_Retrieved", "Secret_Edited"]);
    expect(data[0]).toMatchObject({ object: "sm-event", machineAccountId, secretId });
  });

  it("rejects an invalid date", async () => {
    const response = await command.run(smOrgId, options({ start: "yesterday-ish" }));

    expect(response.success).toBe(false);
    expect(response.message).toBe("`yesterday-ish` is not a valid date for `start`.");
    expect(eventLogApiService.getEvents).not.toHaveBeenCalled();
  });

  it("rejects a start date after the end date", async () => {
    const response = await command.run(
      smOrgId,
      options({ start: "2026-03-01", end: "2026-02-01" }),
    );

    expect(response.success).toBe(false);
    expect(response.message).toBe("`start` must be before `end`.");
  });

  it("rejects an invalid organization id", async () => {
    const response = await command.run("not-a-guid", options());

    expect(response.success).toBe(false);
    expect(response.message).toBe("`not-a-guid` is not a GUID.");
  });

  it("rejects an invalid machine account id", async () => {
    const response = await command.run(smOrgId, options({ machineAccountId: "abc" }));

    expect(response.success).toBe(false);
    expect(response.message).toBe("`abc` is not a GUID.");
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, options());

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
    expect(eventLogApiService.getEvents).not.toHaveBeenCalled();
  });

  it("rejects a machine account from another organization", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), {
        id: machineAccountId,
        organizationId: smOtherOrgId,
      }),
    );

    const response = await command.run(smOrgId, options());

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(eventLogApiService.getEvents).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    eventLogApiService.getEvents.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, options());

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });
});
