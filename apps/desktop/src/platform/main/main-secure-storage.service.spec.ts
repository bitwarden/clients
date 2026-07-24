import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { MainSecureStorageService } from "./main-secure-storage.service";

jest.mock("@bitwarden/desktop-napi", () => ({
  passwords: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
    deletePassword: jest.fn(),
    PASSWORD_NOT_FOUND: "Password not found.",
  },
}));

const napiPasswords = jest.requireMock("@bitwarden/desktop-napi").passwords as {
  getPassword: jest.Mock;
  setPassword: jest.Mock;
  deletePassword: jest.Mock;
  PASSWORD_NOT_FOUND: string;
};

describe("MainSecureStorageService", () => {
  let service: MainSecureStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MainSecureStorageService(mock<LogService>());
  });

  describe("service name / keySuffix", () => {
    it("uses the base service name when no key suffix is provided", async () => {
      napiPasswords.getPassword.mockResolvedValue(JSON.stringify("v"));

      await service.get("k");

      expect(napiPasswords.getPassword).toHaveBeenCalledWith("Bitwarden", "k");
    });

    it("appends the key suffix to the service name", async () => {
      napiPasswords.setPassword.mockResolvedValue(undefined);

      await service.save("k", "v", { keySuffix: "user" as any });

      expect(napiPasswords.setPassword).toHaveBeenCalledWith("Bitwarden_user", "k", '"v"');
    });
  });

  describe("get", () => {
    it("deserializes the stored JSON value", async () => {
      napiPasswords.getPassword.mockResolvedValue(JSON.stringify({ a: 1 }));

      await expect(service.get<{ a: number }>("k")).resolves.toEqual({ a: 1 });
    });

    it("returns null when the value is missing", async () => {
      napiPasswords.getPassword.mockResolvedValue(null);

      await expect(service.get("k")).resolves.toBeNull();
    });

    it("returns null when the credential store throws PASSWORD_NOT_FOUND", async () => {
      napiPasswords.getPassword.mockRejectedValue(new Error(napiPasswords.PASSWORD_NOT_FOUND));

      await expect(service.get("k")).resolves.toBeNull();
    });

    it("rethrows unexpected errors", async () => {
      napiPasswords.getPassword.mockRejectedValue(new Error("kaboom"));

      await expect(service.get("k")).rejects.toThrow("kaboom");
    });
  });

  describe("has", () => {
    it("is true when a value exists", async () => {
      napiPasswords.getPassword.mockResolvedValue(JSON.stringify("v"));
      await expect(service.has("k")).resolves.toBe(true);
    });

    it("is false when PASSWORD_NOT_FOUND is thrown", async () => {
      napiPasswords.getPassword.mockRejectedValue(new Error(napiPasswords.PASSWORD_NOT_FOUND));
      await expect(service.has("k")).resolves.toBe(false);
    });
  });

  describe("remove", () => {
    it("delegates to deletePassword", async () => {
      napiPasswords.deletePassword.mockResolvedValue(undefined);

      await service.remove("k", { keySuffix: "user" as any });

      expect(napiPasswords.deletePassword).toHaveBeenCalledWith("Bitwarden_user", "k");
    });

    it("swallows PASSWORD_NOT_FOUND", async () => {
      napiPasswords.deletePassword.mockRejectedValue(new Error(napiPasswords.PASSWORD_NOT_FOUND));

      await expect(service.remove("k")).resolves.toBeUndefined();
    });
  });
});
