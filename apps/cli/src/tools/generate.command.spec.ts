import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PasswordGeneratorPolicyOptions } from "@bitwarden/common/admin-console/models/domain/password-generator-policy-options";
import { AccountService, Account } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  PasswordGeneratorOptions,
  PasswordGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";

import { GenerateCommand } from "./generate.command";

describe("GenerateCommand", () => {
  let command: GenerateCommand;
  let passwordGenerationService: jest.Mocked<PasswordGenerationServiceAbstraction>;
  let tokenService: jest.Mocked<TokenService>;
  let accountService: jest.Mocked<AccountService>;

  const userId = "test-user-id" as UserId;
  const account: Account = {
    id: userId,
    email: "test@example.com",
    emailVerified: true,
    name: undefined,
    creationDate: undefined,
  };

  beforeEach(() => {
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    tokenService = mock<TokenService>();
    accountService = mock<AccountService>();

    passwordGenerationService.generatePassword.mockResolvedValue("generated-password");

    command = new GenerateCommand(passwordGenerationService, tokenService, accountService);
  });

  function setupLoggedIn() {
    accountService.activeAccount$ = of(account);
    tokenService.hasAccessToken$.mockReturnValue(of(true));
  }

  function setupLoggedOut() {
    accountService.activeAccount$ = of(null);
  }

  function mockEnforce(overrides: Partial<PasswordGeneratorOptions>) {
    passwordGenerationService.enforcePasswordGeneratorPoliciesOnOptions.mockImplementation(
      async (options) =>
        [{ ...options, ...overrides }, new PasswordGeneratorPolicyOptions()] as [
          PasswordGeneratorOptions,
          PasswordGeneratorPolicyOptions,
        ],
    );
  }

  function setupNoopEnforce() {
    mockEnforce({});
  }

  describe("when the user is not logged in", () => {
    it("succeeds without applying policy enforcement", async () => {
      setupLoggedOut();

      const response = await command.run({});

      expect(response.success).toBe(true);
      expect(
        passwordGenerationService.enforcePasswordGeneratorPoliciesOnOptions,
      ).not.toHaveBeenCalled();
    });
  });

  describe("when the user is logged in", () => {
    beforeEach(() => {
      setupLoggedIn();
    });

    it("succeeds when no options are supplied", async () => {
      setupNoopEnforce();

      const response = await command.run({});

      expect(response.success).toBe(true);
    });

    describe("password conflict detection", () => {
      it("returns badRequest when --length is below the policy minimum", async () => {
        mockEnforce({ length: 20 });

        const response = await command.run({ length: 8 });

        expect(response.success).toBe(false);
        expect(response.message).toContain("--length 8");
        expect(response.message).toContain("policy requires a minimum length of 20");
      });

      it("succeeds when --length meets the policy minimum", async () => {
        mockEnforce({ length: 20 });

        const response = await command.run({ length: 20 });

        expect(response.success).toBe(true);
      });

      it("returns badRequest when --minNumber is below the policy minimum", async () => {
        mockEnforce({ minNumber: 5 });

        const response = await command.run({ minNumber: 1 });

        expect(response.success).toBe(false);
        expect(response.message).toContain("--minNumber 1");
        expect(response.message).toContain("policy requires a minimum of 5 numbers");
      });

      it("returns badRequest when --minSpecial is below the policy minimum", async () => {
        mockEnforce({ minSpecial: 3 });

        const response = await command.run({ minSpecial: 0 });

        expect(response.success).toBe(false);
        expect(response.message).toContain("--minSpecial 0");
        expect(response.message).toContain("policy requires a minimum of 3 special characters");
      });

      it("reports all numeric conflicts in a single response", async () => {
        mockEnforce({ length: 20, minNumber: 5, minSpecial: 3 });

        const response = await command.run({ length: 8, minNumber: 1, minSpecial: 0 });

        expect(response.success).toBe(false);
        expect(response.message).toContain("--length 8");
        expect(response.message).toContain("--minNumber 1");
        expect(response.message).toContain("--minSpecial 0");
      });

      it("returns badRequest when user supplies char-type flags and policy adds uppercase", async () => {
        // User only supplies --special; policy adds uppercase
        mockEnforce({ uppercase: true });

        const response = await command.run({ special: true });

        expect(response.success).toBe(false);
        expect(response.message).toContain("policy requires uppercase letters");
        expect(response.message).toContain("--uppercase");
      });

      it("returns badRequest when user supplies char-type flags and policy adds lowercase", async () => {
        // User only supplies --uppercase; policy adds lowercase
        mockEnforce({ lowercase: true });

        const response = await command.run({ uppercase: true });

        expect(response.success).toBe(false);
        expect(response.message).toContain("policy requires lowercase letters");
      });

      it("returns badRequest when user supplies char-type flags and policy adds numbers", async () => {
        // User only supplies --uppercase; policy adds numbers
        mockEnforce({ number: true });

        const response = await command.run({ uppercase: true });

        expect(response.success).toBe(false);
        expect(response.message).toContain("policy requires numbers");
      });

      it("returns badRequest when user supplies char-type flags and policy adds special characters", async () => {
        // User only supplies --uppercase; policy adds special characters
        mockEnforce({ special: true });

        const response = await command.run({ uppercase: true });

        expect(response.success).toBe(false);
        expect(response.message).toContain("policy requires special characters");
      });

      it("succeeds when no char-type flags are supplied and policy adds a character type", async () => {
        // Policy adds special, but user expressed no preference — no conflict
        mockEnforce({ special: true });

        const response = await command.run({});

        expect(response.success).toBe(true);
      });

      it("succeeds when the user explicitly supplies a char-type flag that policy also requires", async () => {
        setupNoopEnforce();

        const response = await command.run({ uppercase: true });

        expect(response.success).toBe(true);
      });
    });

    describe("passphrase conflict detection", () => {
      it("returns badRequest when --words is below the policy minimum", async () => {
        mockEnforce({ numWords: 7 });

        const response = await command.run({ passphrase: true, words: 5 });

        expect(response.success).toBe(false);
        expect(response.message).toContain("--words 5");
        expect(response.message).toContain("policy requires a minimum of 7 words");
      });

      it("succeeds when --words meets the policy minimum", async () => {
        mockEnforce({ numWords: 5 });

        const response = await command.run({ passphrase: true, words: 7 });

        expect(response.success).toBe(true);
      });

      it("does not apply password conflict checks for passphrase type", async () => {
        // Policy raises length (would be a conflict for password type), but this is a passphrase
        mockEnforce({ length: 30 });

        const response = await command.run({ passphrase: true, length: 8 });

        expect(response.success).toBe(true);
      });
    });

    it("detects conflicts when the service mutates the options object in place (regression)", async () => {
      passwordGenerationService.enforcePasswordGeneratorPoliciesOnOptions.mockImplementation(
        async (options) => {
          Object.assign(options, { length: 20 }); // simulate real mutation
          return [options, new PasswordGeneratorPolicyOptions()] as [
            PasswordGeneratorOptions,
            PasswordGeneratorPolicyOptions,
          ];
        },
      );

      const response = await command.run({ length: 8 });

      expect(response.success).toBe(false);
      expect(response.message).toContain("--length 8");
      expect(response.message).toContain("policy requires a minimum length of 20");
    });

    it("includes a remediation hint in the error message", async () => {
      mockEnforce({ length: 20 });

      const response = await command.run({ length: 8 });

      expect(response.message).toContain('Run "bw generate" without those options');
    });
  });
});
