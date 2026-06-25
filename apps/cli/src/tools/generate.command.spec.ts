import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { GenerateCommand } from "./generate.command";

describe("GenerateCommand", () => {
  let command: GenerateCommand;

  const passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
  const tokenService = mock<TokenService>();
  const accountService = mock<AccountService>();

  beforeEach(() => {
    jest.clearAllMocks();

    accountService.activeAccount$ = of(null);
    passwordGenerationService.generatePassword.mockResolvedValue("generated-value");

    command = new GenerateCommand(passwordGenerationService, tokenService, accountService);
  });

  it("uses password type when passphrase is the string false", async () => {
    const response = await command.run({
      password: "true",
      passphrase: "false",
      length: "40",
      lowercase: "true",
      uppercase: "true",
      number: "true",
    });

    expect(response.success).toBe(true);
    expect(passwordGenerationService.generatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ type: "password" }),
    );
  });

  it("uses passphrase type when passphrase is the string true", async () => {
    const response = await command.run({
      passphrase: "true",
    });

    expect(response.success).toBe(true);
    expect(passwordGenerationService.generatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ type: "passphrase" }),
    );
  });
});
