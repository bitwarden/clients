import { mock } from "jest-mock-extended";

import { ServiceAccountService, ServiceAccountView } from "@bitwarden/bit-sm";

import {
  encodeSmRequest,
  smNotFoundError,
  smOrgId,
  smOtherOrgId,
  smOrg,
} from "../spec/sm-test-utils";

import { MachineAccountEditCommand } from "./machine-account-edit.command";

describe("MachineAccountEditCommand", () => {
  const serviceAccountService = mock<ServiceAccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  let command: MachineAccountEditCommand;

  const makeMachineAccount = (overrides: Partial<ServiceAccountView> = {}) =>
    Object.assign(new ServiceAccountView(), {
      id: machineAccountId,
      organizationId: smOrgId,
      name: "CI",
      ...overrides,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    command = new MachineAccountEditCommand(serviceAccountService);
  });

  it("renames the machine account", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount());
    serviceAccountService.update.mockResolvedValue(makeMachineAccount({ name: "Deploy" }));

    const response = await command.run(
      smOrg,
      machineAccountId.toUpperCase(),
      encodeSmRequest({ name: "Deploy" }),
    );

    expect(response.success).toBe(true);
    expect(serviceAccountService.update).toHaveBeenCalledWith(
      machineAccountId,
      smOrgId,
      expect.objectContaining({ id: machineAccountId, name: "Deploy" }),
    );
    expect(response.data).toMatchObject({ object: "sm-machine-account", name: "Deploy" });
  });

  it("treats a machine account from another organization as not found", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      makeMachineAccount({ organizationId: smOtherOrgId }),
    );

    const response = await command.run(smOrg, machineAccountId, { name: "Deploy" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(serviceAccountService.update).not.toHaveBeenCalled();
  });

  it("maps a 404 to a friendly error", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrg, machineAccountId, { name: "Deploy" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });

  it("requires a name", async () => {
    const response = await command.run(smOrg, machineAccountId, { name: "  " });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
  });

  describe("read-only properties", () => {
    const getBody = () => ({
      object: "sm-machine-account",
      id: machineAccountId,
      organizationId: smOrgId,
      name: "CI",
      creationDate: "2024-01-01T00:00:00Z",
      revisionDate: "2024-01-02T00:00:00Z",
      decryptionError: false,
    });

    beforeEach(() => {
      serviceAccountService.getByServiceAccountId.mockResolvedValue(
        makeMachineAccount({
          creationDate: "2024-01-01T00:00:00Z",
          revisionDate: "2024-01-02T00:00:00Z",
          decryptionError: false,
        }),
      );
      serviceAccountService.update.mockResolvedValue(makeMachineAccount({ name: "Deploy" }));
    });

    it.each([
      ["a template-shaped body", { organizationId: null, name: "Deploy" }],
      ["a full get-shaped body", { ...getBody(), name: "Deploy" }],
    ])("renames from %s", async (_shape, body) => {
      const response = await command.run(smOrg, machineAccountId, encodeSmRequest(body));

      expect(response.success).toBe(true);
      expect(serviceAccountService.update).toHaveBeenCalledWith(
        machineAccountId,
        smOrgId,
        expect.objectContaining({ id: machineAccountId, name: "Deploy" }),
      );
    });

    it.each([
      ["object", { object: "sm-project" }],
      ["id", { id: "33333333-3333-3333-3333-333333333333" }],
      ["creationDate", { creationDate: "2026-11-17T04:22:34.0716668Z" }],
      ["revisionDate", { revisionDate: "2026-11-17T04:22:34.0716668Z" }],
      ["read", { read: true }],
      ["write", { write: false }],
      ["decryptionError", { decryptionError: true }],
      ["accessToSecrets", { accessToSecrets: 1 }],
    ])("rejects a changed %s and saves nothing", async (property, change) => {
      const response = await command.run(smOrg, machineAccountId, {
        ...getBody(),
        name: "Renamed",
        ...change,
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`" +
          property +
          "` cannot be edited on a machine account. Remove this property from the request.",
      );
      expect(serviceAccountService.update).not.toHaveBeenCalled();
    });

    it("names every rejected property", async () => {
      const response = await command.run(smOrg, machineAccountId, {
        name: "Renamed",
        write: "true",
        read: true,
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`read`, `write` cannot be edited on a machine account. Remove these properties from the request.",
      );
      expect(serviceAccountService.update).not.toHaveBeenCalled();
    });

    it.each([true, false])(
      "rejects decryptionError %p when it differs from the machine account's and saves nothing",
      async (decryptionError) => {
        serviceAccountService.getByServiceAccountId.mockResolvedValue(
          makeMachineAccount({ decryptionError: !decryptionError }),
        );

        const response = await command.run(
          smOrg,
          machineAccountId,
          encodeSmRequest({ organizationId: null, name: "Machine account name", decryptionError }),
        );

        expect(response.success).toBe(false);
        expect(response.message).toBe(
          "`decryptionError` cannot be edited on a machine account. Remove this property from the request.",
        );
        expect(serviceAccountService.update).not.toHaveBeenCalled();
      },
    );
  });

  describe("unknown properties", () => {
    beforeEach(() => {
      serviceAccountService.getByServiceAccountId.mockResolvedValue(makeMachineAccount());
      serviceAccountService.update.mockResolvedValue(
        makeMachineAccount({ name: "Machine account name" }),
      );
    });

    it.each([true, false])(
      "rejects decryptError %p added to the template and saves nothing",
      async (decryptError) => {
        const response = await command.run(
          smOrg,
          machineAccountId,
          encodeSmRequest({ organizationId: null, name: "Machine account name", decryptError }),
        );

        expect(response.success).toBe(false);
        expect(response.message).toBe(
          "`decryptError` is not a machine account property. Remove this property from the request. Properties that can be edited on a machine account: `name`.",
        );
        expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
        expect(serviceAccountService.update).not.toHaveBeenCalled();
      },
    );

    it("names every unknown property", async () => {
      const response = await command.run(smOrg, machineAccountId, {
        name: "Deploy",
        Name: "Deploy",
        enabled: false,
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`Name`, `enabled` are not machine account properties. Remove these properties from the request. Properties that can be edited on a machine account: `name`.",
      );
      expect(serviceAccountService.update).not.toHaveBeenCalled();
    });
  });
});
