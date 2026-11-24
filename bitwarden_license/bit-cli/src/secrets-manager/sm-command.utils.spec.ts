import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  BulkOperationStatus,
  ProjectView,
  SecretView,
  ServiceAccountSecretsDetailsView,
} from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { CliUtils } from "@bitwarden/cli/utils";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { SmMachineAccountResponse } from "./models/sm-machine-account.response";
import { SmProjectResponse } from "./models/sm-project.response";
import { SmSecretResponse } from "./models/sm-secret.response";
import {
  checkSmReadOnlyProperties,
  checkSmRequestOrganization,
  checkSmUnknownProperties,
  isInSmOrganization,
  parseSmId,
  parseSmIds,
  parseSmRequest,
  readSmName,
  SM_EDITABLE_PROPERTIES,
  SM_READ_ONLY_PROPERTIES,
  validateSmOrganizationAccess,
  smBulkResponse,
  smErrorResponse,
  withSmOrganization,
} from "./sm-command.utils";
import {
  encodeSmRequest,
  mockSmOrganization,
  smNotFoundError,
  smOrg,
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

  describe("isInSmOrganization", () => {
    const org = smOrg;

    it("matches the organization id case-insensitively", () => {
      expect(isInSmOrganization({ organizationId: smOrgId.toUpperCase() }, org)).toBe(true);
    });

    it("rejects another organization or a missing id", () => {
      expect(isInSmOrganization({ organizationId: smOtherOrgId }, org)).toBe(false);
      expect(isInSmOrganization({}, org)).toBe(false);
    });
  });

  describe("parseSmId", () => {
    it("lowercases a valid GUID", () => {
      expect(parseSmId(smOrgId.toUpperCase(), "id")).toEqual({ id: smOrgId });
    });

    it("rejects a missing id", () => {
      expect(parseSmId("", "projectid").error?.message).toBe("`projectid` is required.");
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

  describe("checkSmReadOnlyProperties", () => {
    const guid = "22222222-2222-2222-2222-222222222222";
    const existing = {
      object: "sm-project",
      id: guid,
      organizationId: smOrgId,
      name: "Backend",
      creationDate: "2024-01-01T00:00:00Z",
      revisionDate: "2024-01-02T00:00:00Z",
      read: true,
      write: true,
      decryptionError: false,
    };

    it("allows a request without read-only properties", () => {
      expect(checkSmReadOnlyProperties({ name: "A" }, "project", existing)).toBeUndefined();
    });

    it("allows read-only values equal to the existing ones so get output can be piped into edit", () => {
      expect(checkSmReadOnlyProperties({ ...existing, name: "A" }, "project", existing)).toBe(
        undefined,
      );
    });

    it("compares GUIDs case-insensitively", () => {
      expect(
        checkSmReadOnlyProperties({ id: guid.toUpperCase() }, "project", existing),
      ).toBeUndefined();
    });

    it.each([
      ["object", "sm-secret"],
      ["id", "33333333-3333-3333-3333-333333333333"],
      ["creationDate", "2026-11-17T04:22:34.0716668Z"],
      ["revisionDate", "2026-11-17T04:22:34.0716668Z"],
      ["read", false],
      ["write", false],
      ["write", "true"],
      ["decryptionError", true],
      ["accessToSecrets", 3],
    ])("rejects a changed %s (%p)", (property, value) => {
      expect(
        checkSmReadOnlyProperties({ name: "A", [property]: value }, "project", existing)?.message,
      ).toBe(
        "`" + property + "` cannot be edited on a project. Remove this property from the request.",
      );
    });

    it("rejects a read-only property the existing entity does not have", () => {
      expect(
        checkSmReadOnlyProperties({ read: true }, "machine account", { name: "CI" })?.message,
      ).toBe(
        "`read` cannot be edited on a machine account. Remove this property from the request.",
      );
    });

    it("names multiple properties in the plural", () => {
      expect(
        checkSmReadOnlyProperties(
          { id: "33333333-3333-3333-3333-333333333333", write: false, creationDate: "x" },
          "project",
          existing,
        )?.message,
      ).toBe(
        "`id`, `creationDate`, `write` cannot be edited on a project. Remove these properties from the request.",
      );
    });

    it("treats a false value as present and null or whitespace-only values as missing", () => {
      expect(checkSmReadOnlyProperties({ read: false }, "project", existing)?.success).toBe(false);
      expect(
        checkSmReadOnlyProperties({ read: "  ", id: null }, "project", existing),
      ).toBeUndefined();
    });

    it("leaves organizationId to checkSmRequestOrganization", () => {
      expect(SM_READ_ONLY_PROPERTIES).not.toContain("organizationId");
    });

    // Every property an edit command's response prints must be either editable or read-only, so
    // a new response property cannot silently become an ignored request property, and the output
    // of `get` is never rejected as unknown.
    it.each([
      ["project", new SmProjectResponse(new ProjectView())],
      [
        "machine account",
        new SmMachineAccountResponse(
          Object.assign(new ServiceAccountSecretsDetailsView(), { accessToSecrets: 1 }),
        ),
      ],
      ["secret", new SmSecretResponse(new SecretView())],
    ] as const)("covers every %s response property", (entity, response) => {
      const editable: readonly string[] = SM_EDITABLE_PROPERTIES[entity];
      const readOnly: readonly string[] = SM_READ_ONLY_PROPERTIES;
      const keys = Object.keys(response);
      const uncovered = keys.filter(
        (key) => key !== "organizationId" && !editable.includes(key) && !readOnly.includes(key),
      );
      expect(uncovered).toEqual([]);
      expect(
        checkSmUnknownProperties(Object.fromEntries(keys.map((key) => [key, "x"])), entity),
      ).toBeUndefined();
    });
  });

  describe("checkSmUnknownProperties", () => {
    it("allows editable, read-only and organizationId properties", () => {
      expect(
        checkSmUnknownProperties(
          { organizationId: smOrgId, name: "A", id: "x", decryptionError: false },
          "project",
        ),
      ).toBeUndefined();
    });

    it.each([true, false])("rejects the misspelled decryptError %p", (decryptError) => {
      expect(checkSmUnknownProperties({ name: "A", decryptError }, "project")?.message).toBe(
        "`decryptError` is not a project property. Remove this property from the request. Properties that can be edited on a project: `name`.",
      );
    });

    it("matches property names case-sensitively", () => {
      expect(checkSmUnknownProperties({ Name: "A" }, "machine account")?.message).toBe(
        "`Name` is not a machine account property. Remove this property from the request. Properties that can be edited on a machine account: `name`.",
      );
    });

    it("names multiple properties in the plural", () => {
      expect(checkSmUnknownProperties({ key: "A", name: "A", notes: "x" }, "secret")?.message).toBe(
        "`name`, `notes` are not secret properties. Remove these properties from the request. Properties that can be edited on a secret: `key`, `value`, `note`, `projectIds`, `projects`.",
      );
    });

    it("treats a false value as present and null or whitespace-only values as missing", () => {
      expect(checkSmUnknownProperties({ enabled: false }, "project")?.success).toBe(false);
      expect(
        checkSmUnknownProperties({ a: null, b: undefined, c: " " }, "project"),
      ).toBeUndefined();
    });
  });

  describe("checkSmRequestOrganization", () => {
    it("allows a missing or matching organization id", () => {
      expect(checkSmRequestOrganization(smOrgId, undefined)).toBeUndefined();
      expect(checkSmRequestOrganization(smOrgId, smOrgId.toUpperCase())).toBeUndefined();
    });

    it("treats a whitespace-only organization id as missing", () => {
      expect(checkSmRequestOrganization(smOrgId, "  ")).toBeUndefined();
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

  describe("validateSmOrganizationAccess", () => {
    it("returns the normalized organization id and the organization", async () => {
      const result = await validateSmOrganizationAccess(
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
      const result = await validateSmOrganizationAccess(organizationService, accountService, "bad");
      expect(result.error?.message).toBe("`bad` is not a GUID.");
    });

    it("rejects when there is no active user", async () => {
      accountService.activeAccount$ = of(null);
      const result = await validateSmOrganizationAccess(
        organizationService,
        accountService,
        smOrgId,
      );
      expect(result.error?.message).toBe("No user found.");
    });

    it("rejects an organization the user is not a member of", async () => {
      const result = await validateSmOrganizationAccess(
        organizationService,
        accountService,
        smOtherOrgId,
      );
      expect(result.error?.message).toBe("Organization not found.");
    });

    it("rejects an organization without Secrets Manager access", async () => {
      mockSmOrganization(accountService, organizationService, false);
      const result = await validateSmOrganizationAccess(
        organizationService,
        accountService,
        smOrgId,
      );
      expect(result.error?.message).toBe(
        "You do not have access to Secrets Manager for this organization.",
      );
    });
  });

  describe("withSmOrganization", () => {
    const services = { organizationService, accountService };

    it("runs the action with the validated organization", async () => {
      const action = jest.fn().mockResolvedValue(Response.success(undefined));

      const response = await withSmOrganization(services, smOrgId.toUpperCase(), action);

      expect(response.success).toBe(true);
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: smOrgId,
          organization: expect.objectContaining({ id: smOrgId }),
        }),
      );
    });

    it.each([
      ["rejects an invalid organization id", "bad", "`bad` is not a GUID."],
      ["rejects a missing organization id", "", "`organizationid` is required."],
      [
        "rejects an organization the user is not a member of",
        smOtherOrgId,
        "Organization not found.",
      ],
    ])("%s without running the action", async (_name, organizationId, message) => {
      const action = jest.fn();

      const response = await withSmOrganization(services, organizationId, action);

      expect(response.success).toBe(false);
      expect(response.message).toBe(message);
      expect(action).not.toHaveBeenCalled();
    });

    it("rejects when there is no active user without running the action", async () => {
      accountService.activeAccount$ = of(null);
      const action = jest.fn();

      const response = await withSmOrganization(services, smOrgId, action);

      expect(response.message).toBe("No user found.");
      expect(action).not.toHaveBeenCalled();
    });

    it("rejects an organization without Secrets Manager access without running the action", async () => {
      mockSmOrganization(accountService, organizationService, false);
      const action = jest.fn();

      const response = await withSmOrganization(services, smOrgId, action);

      expect(response.message).toBe(
        "You do not have access to Secrets Manager for this organization.",
      );
      expect(action).not.toHaveBeenCalled();
    });

    it("returns the response of the action", async () => {
      const failure = Response.error("Nope.");

      const response = await withSmOrganization(services, smOrgId, async () => failure);

      expect(response).toBe(failure);
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
