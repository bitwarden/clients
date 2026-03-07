import { mock } from "jest-mock-extended";

import { GeneratorDependencyProvider } from "../../providers";
import { LoginEmailGenerationOptions } from "../../types";
import { Profile } from "../data";
import { CoreProfileMetadata } from "../profile-metadata";
import { isCoreProfile } from "../util";

import loginEmail from "./login-email";

const dependencyProvider = mock<GeneratorDependencyProvider>();

describe("email - login email generator metadata", () => {
  describe("engine.create", () => {
    it("returns an engine", () => {
      expect(loginEmail.engine.create(dependencyProvider)).toBeDefined();
    });

    it("throws when settings.email is empty", async () => {
      const engine = loginEmail.engine.create(dependencyProvider);
      const request = { algorithm: loginEmail.id };

      await expect(engine.generate(request as any, { email: "" })).rejects.toThrow(
        "Cannot generate login email without a verified account email.",
      );
    });

    it("returns the stored email when populated", async () => {
      const engine = loginEmail.engine.create(dependencyProvider);
      const request = { algorithm: loginEmail.id };

      const result = await engine.generate(request as any, { email: "test@example.com" });

      expect(result.credential).toEqual("test@example.com");
    });
  });

  describe("profiles[account]", () => {
    let accountProfile: CoreProfileMetadata<LoginEmailGenerationOptions> = null!;
    beforeEach(() => {
      const profile = loginEmail.profiles[Profile.account];
      if (isCoreProfile(profile!)) {
        accountProfile = profile;
      } else {
        throw new Error("this branch should never run");
      }
    });

    describe("storage.options.deserializer", () => {
      it("returns its input", () => {
        const value: LoginEmailGenerationOptions = { email: "foo@example.com" };
        const result = accountProfile.storage.options.deserializer(value);
        expect(result).toBe(value);
      });
    });

    describe("constraints.create", () => {
      it("seeds email from context.email when settings.email is empty", () => {
        const context = { email: "context@example.com", defaultConstraints: {} };
        const constraints = accountProfile.constraints.create([], context);
        const adjusted = (constraints as any).adjust({ email: "" });
        expect(adjusted.email).toEqual("context@example.com");
      });

      it("does not override settings.email when already populated", () => {
        const context = { email: "context@example.com", defaultConstraints: {} };
        const constraints = accountProfile.constraints.create([], context);
        const adjusted = (constraints as any).adjust({ email: "existing@example.com" });
        expect(adjusted.email).toEqual("existing@example.com");
      });
    });
  });
});
