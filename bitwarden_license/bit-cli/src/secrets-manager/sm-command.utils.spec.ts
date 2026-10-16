import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { BulkOperationStatus } from "@bitwarden/bit-common/secrets-manager/models/bulk-operation-status";
import { CliUtils } from "@bitwarden/cli/utils";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import {
  checkSmRequestOrganization,
  parseSmId,
  parseSmIds,
  parseSmRequest,
  readSmName,
  resolveSmOrganization,
  smBulkResponse,
  smErrorResponse,
} from "./sm-command.utils";
import {
  encodeSmRequest,
  mockSmOrganization,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
} from "./spec/sm-test-utils";

describe("sm-command.utils", () => {
  const accountService = mock<AccountService>();
  const organizationService = mock<OrganizationService>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
  });

  describe("parseSmId", () => {
    it("lowercases a valid GUID", () => {
      expect(parseSmId(smOrgId.toUpperCase(), "id")).toEqual({ id: smOrgId });
    });

    it("rejects a missing id", () => {
      expect(parseSmId(undefined, "projectid").error?.message).toBe("`projectid` is required.");
    });

    it("rejects a non-GUID", () => {
      expect(parseSmId("nope", "id").error?.message).toBe("`nope` is not a GUID.");
    });
  });

  describe("parseSmIds", () => {
    it("lowercases and de-duplicates ids", () => {
      expect(parseSmIds([smOrgId.toUpperCase(), smOrgId], "id")).toEqual({ ids: [smOrgId] });
    });

    it("rejects an empty list", () => {
      expect(parseSmIds([], "secretId").error?.message).toBe(
        "At least one `secretId` is required.",
      );
    });

    it("rejects a non-GUID in the list", () => {
      expect(parseSmIds([smOrgId, "nope"], "id").error?.message).toBe("`nope` is not a GUID.");
    });
  });

  describe("parseSmRequest", () => {
    afterEach(() => {
      delete process.env.BW_SERVE;
      jest.restoreAllMocks();
    });

    it("decodes a base64 JSON argument", async () => {
      const result = await parseSmRequest(encodeSmRequest({ name: "Backend" }));
      expect(result).toEqual({ request: { name: "Backend" } });
    });

    it("accepts an object body from bw serve", async () => {
      const result = await parseSmRequest({ name: "Backend" });
      expect(result).toEqual({ request: { name: "Backend" } });
    });

    it("reads stdin when no argument is given", async () => {
      jest.spyOn(CliUtils, "readStdin").mockResolvedValue(encodeSmRequest({ name: "Backend" }));
      const result = await parseSmRequest(undefined);
      expect(result).toEqual({ request: { name: "Backend" } });
    });

    it("does not read stdin under bw serve", async () => {
      process.env.BW_SERVE = "true";
      const readStdin = jest.spyOn(CliUtils, "readStdin");
      const result = await parseSmRequest(undefined);
      expect(readStdin).not.toHaveBeenCalled();
      expect(result.error?.message).toBe("`requestJson` was not provided.");
    });

    it("rejects data that is not encoded JSON", async () => {
      const result = await parseSmRequest("not base64 json");
      expect(result.error?.message).toBe("Error parsing the encoded request data.");
    });

    it("rejects JSON that is not an object", async () => {
      const result = await parseSmRequest(encodeSmRequest(["a"]));
      expect(result.error?.message).toBe("The request data must be a JSON object.");
    });
  });

  describe("checkSmRequestOrganization", () => {
    it("allows a missing or matching organization id", () => {
      expect(checkSmRequestOrganization(smOrgId, undefined)).toBeUndefined();
      expect(checkSmRequestOrganization(smOrgId, smOrgId.toUpperCase())).toBeUndefined();
    });

    it("rejects a different organization id", () => {
      expect(checkSmRequestOrganization(smOrgId, smOtherOrgId)?.message).toBe(
        "The request's `organizationId` property does not match the organization id.",
      );
    });
  });

  describe("readSmName", () => {
    it("returns the name", () => {
      expect(readSmName({ name: "Backend" })).toEqual({ name: "Backend" });
    });

    it("rejects a blank or missing name", () => {
      expect(readSmName({ name: " " }).error?.message).toBe("`name` is required.");
      expect(readSmName({}).error?.message).toBe("`name` is required.");
    });

    it("rejects a non-string name", () => {
      expect(readSmName({ name: 5 }).error?.message).toBe("`name` must be a string.");
    });
  });

  describe("smBulkResponse", () => {
    const status = (id: string, name: string, errorMessage?: string) =>
      Object.assign(new BulkOperationStatus(), { id, name, errorMessage });

    it("lists the results when every item succeeded", () => {
      const response = smBulkResponse([status("a", "One"), status("b", "Two", "")], "deleted");

      expect(response.success).toBe(true);
      expect(response.data).toMatchObject({
        object: "list",
        data: [
          { object: "sm-bulk-status", id: "a", name: "One" },
          { object: "sm-bulk-status", id: "b", name: "Two" },
        ],
      });
    });

    it("fails and names each item that failed", () => {
      const response = smBulkResponse(
        [status("a", "One"), status("b", "Two", "Access denied.")],
        "deleted",
      );

      expect(response.success).toBe(false);
      expect(response.message).toBe("1 of 2 could not be deleted.\nTwo (b): Access denied.");
    });
  });

  describe("resolveSmOrganization", () => {
    it("returns the normalized organization id and the organization", async () => {
      const result = await resolveSmOrganization(
        organizationService,
        accountService,
        smOrgId.toUpperCase(),
      );
      expect(result).toEqual({
        organizationId: smOrgId,
        organization: expect.objectContaining({ id: smOrgId }),
      });
    });

    it("rejects an invalid organization id", async () => {
      const result = await resolveSmOrganization(organizationService, accountService, "bad");
      expect(result.error?.message).toBe("`bad` is not a GUID.");
    });

    it("rejects when there is no active user", async () => {
      accountService.activeAccount$ = of(null);
      const result = await resolveSmOrganization(organizationService, accountService, smOrgId);
      expect(result.error?.message).toBe("No user found.");
    });

    it("rejects an organization the user is not a member of", async () => {
      const result = await resolveSmOrganization(organizationService, accountService, smOtherOrgId);
      expect(result.error?.message).toBe("Organization not found.");
    });

    it("rejects an organization without Secrets Manager access", async () => {
      mockSmOrganization(accountService, organizationService, false);
      const result = await resolveSmOrganization(organizationService, accountService, smOrgId);
      expect(result.error?.message).toBe(
        "You do not have access to Secrets Manager for this organization.",
      );
    });
  });

  describe("smErrorResponse", () => {
    it("maps a 404 to a not-found message", () => {
      expect(smErrorResponse(smNotFoundError(), "project").message).toBe(
        "The project was not found, or you do not have access to it.",
      );
    });

    it("passes other API errors through", () => {
      const error = new ErrorResponse({ Message: "Bad things." }, 400);
      expect(smErrorResponse(error, "project").message).toBe("Bad things.");
    });
  });
});
