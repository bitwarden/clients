import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherRiskResult } from "@bitwarden/sdk-internal";

import { ListResponse } from "../models/response/list.response";
import { PasswordHealthResponse } from "../models/response/password-health.response";

import { ReportCommand } from "./report.command";

describe("ReportCommand", () => {
  const cipherService = mock<CipherService>();
  const cipherRiskService = mock<CipherRiskService>();
  const accountService = mock<AccountService>();
  const logService = mock<LogService>();

  const userId = "user-id" as UserId;
  const activeAccount = {
    id: userId,
    ...mockAccountInfoWith({ email: "user@example.com", name: "Test User" }),
  };

  let command: ReportCommand;
  let stderrSpy: jest.SpyInstance;

  const buildCipher = (id: string, name: string): CipherView => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.name = name;
    cipher.type = CipherType.Login;
    cipher.login.password = "password";
    return cipher;
  };

  const buildResult = (
    id: string,
    overrides: Partial<CipherRiskResult> = {},
  ): CipherRiskResult => ({
    id: id as unknown as CipherRiskResult["id"],
    password_strength: 1,
    exposed_result: { type: "NotChecked" },
    reuse_count: undefined,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BW_QUIET;
    // Jest's stderr isn't a TTY, so the command takes the static-line fallback path.
    stderrSpy = jest.spyOn(process.stderr, "write").mockReturnValue(true);
    accountService.activeAccount$ = of(activeAccount);
    cipherService.getAllDecrypted.mockResolvedValue([]);
    cipherRiskService.buildPasswordReuseMap.mockResolvedValue({});
    cipherRiskService.computeRiskForCiphers.mockResolvedValue([]);
    command = new ReportCommand(cipherService, cipherRiskService, accountService, logService);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    delete process.env.BW_QUIET;
  });

  it("returns a bad request for an unknown object", async () => {
    const response = await command.run("not-a-report", {});

    expect(response.success).toBe(false);
  });

  it("maps SDK results into password-health rows enriched with the cipher name", async () => {
    cipherService.getAllDecrypted.mockResolvedValue([buildCipher("cipher-1", "Example")]);
    cipherRiskService.computeRiskForCiphers.mockResolvedValue([
      buildResult("cipher-1", {
        password_strength: 2,
        reuse_count: 3,
        exposed_result: { type: "Found", value: 5 },
      }),
    ]);

    const response = await command.run("password-health", {});

    expect(response.success).toBe(true);
    const rows = (response.data as ListResponse).data as PasswordHealthResponse[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "cipher-1",
      name: "Example",
      passwordStrength: 2,
      reuseCount: 3,
      exposed: true,
      exposedCount: 5,
      exposedError: null,
    });
  });

  it("maps a per-item exposure-check error into exposedError", async () => {
    cipherService.getAllDecrypted.mockResolvedValue([buildCipher("cipher-1", "Example")]);
    cipherRiskService.computeRiskForCiphers.mockResolvedValue([
      buildResult("cipher-1", {
        exposed_result: { type: "Error", value: "HIBP request failed" },
      }),
    ]);

    const response = await command.run("password-health", {});

    const rows = (response.data as ListResponse).data as PasswordHealthResponse[];
    expect(rows[0]).toMatchObject({
      exposed: false,
      exposedCount: null,
      exposedError: "HIBP request failed",
    });
  });

  it("reports a unique password (occurrence count of 1) as not reused", async () => {
    cipherService.getAllDecrypted.mockResolvedValue([buildCipher("cipher-1", "Example")]);
    cipherRiskService.computeRiskForCiphers.mockResolvedValue([
      buildResult("cipher-1", { reuse_count: 1 }),
    ]);

    const response = await command.run("password-health", {});

    const rows = (response.data as ListResponse).data as PasswordHealthResponse[];
    expect(rows[0].reuseCount).toBeNull();
  });

  it("checks exposure by default", async () => {
    await command.run("password-health", {});

    expect(cipherRiskService.computeRiskForCiphers).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      expect.objectContaining({ checkExposed: true }),
    );
  });

  it("skips exposure check when --no-check-exposed is passed", async () => {
    await command.run("password-health", { checkExposed: false });

    expect(cipherRiskService.computeRiskForCiphers).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      expect.objectContaining({ checkExposed: false }),
    );
  });

  it("returns an error response when risk computation fails", async () => {
    cipherRiskService.computeRiskForCiphers.mockRejectedValue(new Error("boom"));

    const response = await command.run("password-health", {});

    expect(response.success).toBe(false);
    expect(logService.error).toHaveBeenCalled();
  });

  it("writes a progress message to stderr", async () => {
    cipherService.getAllDecrypted.mockResolvedValue([buildCipher("cipher-1", "Example")]);

    await command.run("password-health", {});

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Have I Been Pwned");
  });

  it("counts only riskable logins in the progress message", async () => {
    const card = new CipherView();
    card.id = "card-1";
    card.type = CipherType.Card;

    const deletedLogin = buildCipher("deleted-1", "Deleted");
    deletedLogin.deletedDate = new Date();

    const emptyPasswordLogin = buildCipher("empty-1", "Empty");
    emptyPasswordLogin.login.password = "";

    cipherService.getAllDecrypted.mockResolvedValue([
      buildCipher("cipher-1", "Example"),
      card,
      deletedLogin,
      emptyPasswordLogin,
    ]);

    await command.run("password-health", {});

    const output = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Checking 1 logins");
  });

  it("suppresses progress output when BW_QUIET is set", async () => {
    process.env.BW_QUIET = "true";
    cipherService.getAllDecrypted.mockResolvedValue([buildCipher("cipher-1", "Example")]);

    await command.run("password-health", {});

    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
