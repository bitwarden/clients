import { mock } from "jest-mock-extended";

import { SecretListView, SecretService } from "@bitwarden/bit-sm";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmSecretResponse } from "../models/sm-secret.response";
import { smNotFoundError, smOrgId, smOrg } from "../spec/sm-test-utils";

import { TrashListCommand } from "./trash-list.command";

describe("TrashListCommand", () => {
  const secretService = mock<SecretService>();
  let command: TrashListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new TrashListCommand(secretService);
  });

  it("lists the trashed secrets", async () => {
    const secret = Object.assign(new SecretListView(), {
      id: "22222222-2222-2222-2222-222222222222",
      organizationId: smOrgId,
      name: "OLD_TOKEN",
      projects: [],
    });
    secretService.getTrashedSecrets.mockResolvedValue([secret]);

    const response = await command.run(smOrg);

    expect(response.success).toBe(true);
    expect(secretService.getTrashedSecrets).toHaveBeenCalledWith(smOrgId);
    const data = (response.data as ListResponse).data as SmSecretResponse[];
    expect(data[0]).toMatchObject({ object: "sm-secret", key: "OLD_TOKEN" });
  });

  it("maps a 404 to a friendly error", async () => {
    secretService.getTrashedSecrets.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The organization was not found, or you do not have access to it.",
    );
  });
});
