import { mock } from "jest-mock-extended";
import { of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, EncString, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { I18nService } from "../../../platform/abstractions/i18n.service";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { ConnectedAppData } from "../models/data/connected-app.data";

import { ConnectedAppStateProvider } from "./connected-app-state.provider.abstraction";
import { ConnectedAppService } from "./connected-app.service";

describe("ConnectedAppService", () => {
  const userId = "user-1" as UserId;
  let keyService: ReturnType<typeof mock<KeyService>>;
  let encryptService: ReturnType<typeof mock<EncryptService>>;
  let i18nService: ReturnType<typeof mock<I18nService>>;
  let stateProvider: ReturnType<typeof mock<ConnectedAppStateProvider>>;
  let sut: ConnectedAppService;

  const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const newUserKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as UserKey;

  function data(id: string): ConnectedAppData {
    const d = new ConnectedAppData();
    d.id = id;
    d.partnerClientId = "partner.acme";
    d.name = "Acme Bot";
    d.key = "2.enc|data|mac";
    d.creationDate = "2024-01-01T00:00:00.000Z";
    d.revisionDate = "2024-01-01T00:00:00.000Z";
    d.revokedDate = null;
    return d;
  }

  beforeEach(() => {
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    i18nService = mock<I18nService>();
    stateProvider = mock<ConnectedAppStateProvider>();
    stateProvider.encryptedState$ = of([userId, {}]);

    sut = new ConnectedAppService(keyService, encryptService, i18nService, stateProvider);
  });

  describe("encrypt", () => {
    it("wraps the plaintext PSK under the user key", async () => {
      keyService.userKey$.mockReturnValue(of(userKey));
      const encrypted = new EncString("2.wrapped|psk|mac");
      encryptService.encryptString.mockResolvedValue(encrypted);

      const connection = await sut.encrypt("partner.acme", "Acme Bot", "plaintext-psk", userId);

      expect(encryptService.encryptString).toHaveBeenCalledWith("plaintext-psk", userKey);
      expect(connection.partnerClientId).toBe("partner.acme");
      expect(connection.name).toBe("Acme Bot");
      expect(connection.key).toBe(encrypted);
    });

    it("throws when there is no user key", async () => {
      keyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

      await expect(sut.encrypt("partner.acme", "Acme Bot", "psk", userId)).rejects.toThrow();
    });
  });

  describe("replace/upsert/delete", () => {
    it("replace writes the record to state", async () => {
      const record = { a: data("a") };

      await sut.replace(record, userId);

      expect(stateProvider.setEncryptedConnectedApps).toHaveBeenCalledWith(record, userId);
    });

    it("upsert merges into existing state", async () => {
      stateProvider.getEncryptedConnectedApps.mockResolvedValue([userId, { a: data("a") }]);

      await sut.upsert(data("b"));

      expect(stateProvider.setEncryptedConnectedApps).toHaveBeenCalledWith(
        expect.objectContaining({ a: expect.anything(), b: expect.anything() }),
        userId,
      );
    });

    it("delete removes the id from state", async () => {
      stateProvider.getEncryptedConnectedApps.mockResolvedValue([
        userId,
        { a: data("a"), b: data("b") },
      ]);

      await sut.delete("a");

      const [written] = stateProvider.setEncryptedConnectedApps.mock.calls[0];
      expect(written).not.toHaveProperty("a");
      expect(written).toHaveProperty("b");
    });
  });

  describe("getRotatedData", () => {
    it("re-wraps each connection's PSK under the new user key", async () => {
      stateProvider.encryptedState$ = of([userId, { a: data("a") }]);
      sut = new ConnectedAppService(keyService, encryptService, i18nService, stateProvider);

      encryptService.decryptString.mockResolvedValue("plaintext-psk");
      encryptService.encryptString.mockResolvedValue(new EncString("2.rewrapped|psk|mac"));

      const rotated = await sut.getRotatedData(userKey, newUserKey, userId);

      expect(encryptService.decryptString).toHaveBeenCalledWith(expect.anything(), userKey);
      expect(encryptService.encryptString).toHaveBeenCalledWith("plaintext-psk", newUserKey);
      expect(rotated).toHaveLength(1);
      expect(rotated[0].id).toBe("a");
      expect(rotated[0].key).toBe("2.rewrapped|psk|mac");
    });

    it("throws when the new user key is missing", async () => {
      await expect(
        sut.getRotatedData(userKey, null as unknown as UserKey, userId),
      ).rejects.toThrow();
    });
  });
});
