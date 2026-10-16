import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";

import { SecretsManagerImportError } from "@bitwarden/bit-common/secrets-manager/settings/models/error/sm-import-error";
import { SecretsManagerPortingApiService } from "@bitwarden/bit-common/secrets-manager/settings/services/sm-porting-api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smOrgId } from "../spec/sm-test-utils";

import { SmImportCommand } from "./sm-import.command";

describe("SmImportCommand", () => {
  const portingApiService = mock<SecretsManagerPortingApiService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const importData = {
    projects: [{ id: "p1", name: "Backend" }],
    secrets: [
      { id: "s1", key: "DB", value: "pw", note: "", projectIds: ["p1"] },
      { id: "s2", key: "API", value: "key", note: "n", projectIds: [] },
    ],
  };
  let command: SmImportCommand;
  let tempDir: string;

  const writeFile = (contents: string) => {
    const file = path.join(tempDir, "import.json");
    fs.writeFileSync(file, contents);
    return file;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService, true, { isAdmin: true });
    portingApiService.import.mockResolvedValue();
    command = new SmImportCommand(portingApiService, organizationService, accountService);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sm-import-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("imports the contents of a file", async () => {
    const file = writeFile(JSON.stringify(importData));

    const response = await command.run(smOrgId, { file });

    expect(response.success).toBe(true);
    expect(portingApiService.import).toHaveBeenCalledWith(smOrgId, JSON.stringify(importData));
    expect(response.data).toMatchObject({
      object: "message",
      title: "Imported 1 project(s) and 2 secret(s).",
    });
  });

  it("imports data passed by bw serve", async () => {
    const response = await command.run(smOrgId, { data: importData });

    expect(response.success).toBe(true);
    expect(portingApiService.import).toHaveBeenCalledWith(smOrgId, JSON.stringify(importData));
  });

  it("rejects users who are not owners or admins", async () => {
    mockSmOrganization(accountService, organizationService, true, { isAdmin: false });

    const response = await command.run(smOrgId, { data: importData });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Only organization owners and admins can import Secrets Manager data.",
    );
    expect(portingApiService.import).not.toHaveBeenCalled();
  });

  it("rejects a missing file", async () => {
    const response = await command.run(smOrgId, { file: path.join(tempDir, "missing.json") });

    expect(response.success).toBe(false);
    expect(response.message).toMatch(/^Could not read file: /);
  });

  it("rejects an empty file", async () => {
    const response = await command.run(smOrgId, { file: writeFile("  ") });

    expect(response.success).toBe(false);
    expect(response.message).toBe("Import file was empty.");
  });

  it("rejects a file that is not JSON", async () => {
    const response = await command.run(smOrgId, { file: writeFile("not json") });

    expect(response.success).toBe(false);
    expect(response.message).toBe("The import file is not valid JSON.");
  });

  it.each([
    [[], "The import data must be a JSON object."],
    [{ secrets: [] }, "`projects` must be an array."],
    [{ projects: [] }, "`secrets` must be an array."],
    [{ projects: [{ id: "p1" }], secrets: [] }, "`projects[0].name` must be a string."],
    [
      { projects: [], secrets: [{ id: "s1", key: "k", value: "v", projectIds: [] }] },
      "`secrets[0].note` must be a string.",
    ],
    [
      { projects: [], secrets: [{ id: "s1", key: "k", value: "v", note: "" }] },
      "`secrets[0].projectIds` must be an array of strings.",
    ],
  ])("rejects malformed data %j", async (data, message) => {
    const response = await command.run(smOrgId, { data });

    expect(response.success).toBe(false);
    expect(response.message).toBe(message);
    expect(portingApiService.import).not.toHaveBeenCalled();
  });

  it("lists each line the server rejected", async () => {
    const error = new SecretsManagerImportError();
    error.lines = [
      { id: 2, type: "Secret", key: "API", errorMessage: "The field Key is invalid." },
    ];
    portingApiService.import.mockRejectedValue(error);

    const response = await command.run(smOrgId, { data: importData });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The import failed:\n  Secret 2 (API): The field Key is invalid.",
    );
  });

  it("returns the server's message when there are no line errors", async () => {
    portingApiService.import.mockRejectedValue(
      new SecretsManagerImportError("You do not have permission."),
    );

    const response = await command.run(smOrgId, { data: importData });

    expect(response.success).toBe(false);
    expect(response.message).toBe("You do not have permission.");
  });
});
