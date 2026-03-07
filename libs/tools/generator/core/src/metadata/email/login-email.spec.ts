import { of, EMPTY } from "rxjs";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";

import { GenerateRequest } from "../../types";
import { Algorithm, Type } from "../data";
import loginEmail from "./login-email";

describe("LoginEmail Generator Strategy and Engine", () => {
  it("should have correct metadata", () => {
    expect(loginEmail.id).toEqual(Algorithm.loginEmail);
    expect(loginEmail.type).toEqual(Type.email);
    expect(loginEmail.capabilities.autogenerate).toBe(true);
  });

  describe("engine", () => {
    it("should throw an error if no account service is provided", async () => {
      const engine = loginEmail.engine.create({} as any);

      const request: GenerateRequest = {
        algorithm: Algorithm.loginEmail,
      };

      await expect(engine.generate(request, {})).rejects.toThrow(
        "Cannot generate login email without an active account.",
      );
    });

    it("should throw an error if no active account is found", async () => {
      const mockAccountService = {
        activeAccount$: of(null),
      };

      const engine = loginEmail.engine.create({
        accountService: mockAccountService as any,
      } as any);

      const request: GenerateRequest = {
        algorithm: Algorithm.loginEmail,
      };

      await expect(engine.generate(request, {})).rejects.toThrow(
        "Cannot generate login email without an active account.",
      );
    });

    it("should return the account email when provided via the service", async () => {
      const mockAccountService = {
        activeAccount$: of({
          id: "fake-id",
          email: "test@example.com",
          emailVerified: true,
          name: "Test User",
          creationDate: new Date(),
        } as Account),
      };

      const engine = loginEmail.engine.create({
        accountService: mockAccountService as any,
      } as any);

      const request: GenerateRequest = {
        algorithm: Algorithm.loginEmail,
      };

      const result = await engine.generate(request, {});

      expect(result.credential).toEqual("test@example.com");
      expect(result.category).toEqual(Type.email);
    });
  });
});
