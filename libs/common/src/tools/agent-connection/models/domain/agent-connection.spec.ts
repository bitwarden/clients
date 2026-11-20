import { mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { EncryptService, EncString } from "@bitwarden/legacy-crypto";

import { UserKey } from "../../../../types/key";
import { AgentConnectionData } from "../data/agent-connection.data";

import { AgentConnection } from "./agent-connection";

describe("AgentConnection", () => {
  function data(): AgentConnectionData {
    const d = new AgentConnectionData();
    d.id = "id-1";
    d.partnerClientId = "partner.acme";
    d.name = "Acme Bot";
    d.key = "2.abc|def|ghi";
    d.creationDate = "2024-01-01T00:00:00.000Z";
    d.revisionDate = "2024-01-02T00:00:00.000Z";
    d.revokedDate = null;
    return d;
  }

  it("constructs a domain model from data", () => {
    const connection = new AgentConnection(data());

    expect(connection.id).toBe("id-1");
    expect(connection.partnerClientId).toBe("partner.acme");
    expect(connection.name).toBe("Acme Bot");
    expect(connection.key).toEqual(new EncString("2.abc|def|ghi"));
    expect(connection.creationDate).toEqual(new Date("2024-01-01T00:00:00.000Z"));
    expect(connection.revisionDate).toEqual(new Date("2024-01-02T00:00:00.000Z"));
    expect(connection.revokedDate).toBeNull();
    expect(connection.revoked).toBe(false);
  });

  it("round-trips through toAgentConnectionData", () => {
    const connection = new AgentConnection(data());

    expect(connection.toAgentConnectionData()).toEqual(data());
  });

  it("reports revoked when a revoked date is present", () => {
    const d = data();
    d.revokedDate = "2024-02-01T00:00:00.000Z";

    expect(new AgentConnection(d).revoked).toBe(true);
  });

  it("decrypts the PSK with the user key", async () => {
    const connection = new AgentConnection(data());
    const encryptService = mock<EncryptService>();
    const userKey = mock<UserKey>();
    encryptService.decryptString.mockResolvedValue("plaintext-psk");

    const view = await connection.decrypt(userKey, encryptService);

    expect(encryptService.decryptString).toHaveBeenCalledWith(connection.key, userKey);
    expect(view.psk).toBe("plaintext-psk");
    expect(view.id).toBe("id-1");
    expect(view.name).toBe("Acme Bot");
  });

  it("deserializes from JSON", () => {
    const connection = new AgentConnection(data());
    const json = JSON.parse(JSON.stringify(connection));

    const restored = AgentConnection.fromJSON(json);

    expect(restored).toEqual(connection);
  });
});
