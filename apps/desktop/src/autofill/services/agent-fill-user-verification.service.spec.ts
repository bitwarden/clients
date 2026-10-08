import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

import { DesktopBiometricsService } from "../../key-management/biometrics/desktop.biometrics.service";

import {
  AgentFillUserVerificationService,
  AgentFillVerificationResult,
} from "./agent-fill-user-verification.service";

describe("AgentFillUserVerificationService", () => {
  let service: AgentFillUserVerificationService;
  const biometricsService = mock<DesktopBiometricsService>();
  const userVerificationService = mock<UserVerificationService>();
  const userDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();

  function arrange(options: { biometrics: boolean; touchId?: boolean; masterPassword: boolean }) {
    biometricsService.getBiometricsStatus.mockResolvedValue(
      options.biometrics ? BiometricsStatus.Available : BiometricsStatus.HardwareUnavailable,
    );
    biometricsService.authenticateWithBiometrics.mockResolvedValue(options.touchId ?? true);
    userDecryptionOptionsService.hasMasterPasswordById$.mockReturnValue(of(options.masterPassword));
  }

  beforeEach(() => {
    jest.resetAllMocks();
    const accountService = mock<AccountService>();
    (accountService as any).activeAccount$ = new BehaviorSubject({ id: "user-1" as UserId });

    TestBed.configureTestingModule({
      providers: [
        AgentFillUserVerificationService,
        { provide: DesktopBiometricsService, useValue: biometricsService },
        { provide: UserVerificationService, useValue: userVerificationService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: userDecryptionOptionsService,
        },
        { provide: AccountService, useValue: accountService },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    });
    service = TestBed.inject(AgentFillUserVerificationService);
  });

  it("verifies with Touch ID when it passes", async () => {
    arrange({ biometrics: true, masterPassword: true });

    expect(await service.verify()).toBe(AgentFillVerificationResult.Verified);
    expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
  });

  it("asks for the master password when Touch ID fails or is cancelled", async () => {
    arrange({ biometrics: true, touchId: false, masterPassword: true });

    expect(await service.verify()).toBe(AgentFillVerificationResult.NeedsMasterPassword);
  });

  it("asks for the master password without trying Touch ID when it is unavailable", async () => {
    arrange({ biometrics: false, masterPassword: true });

    expect(await service.verify()).toBe(AgentFillVerificationResult.NeedsMasterPassword);
    expect(biometricsService.authenticateWithBiometrics).not.toHaveBeenCalled();
  });

  it("fails, so the user can retry, when Touch ID fails and there is no master password", async () => {
    arrange({ biometrics: true, touchId: false, masterPassword: false });

    expect(await service.verify()).toBe(AgentFillVerificationResult.Failed);
  });

  it("is unavailable, not verified, when neither Touch ID nor a master password can verify", async () => {
    arrange({ biometrics: false, masterPassword: false });

    expect(await service.verify()).toBe(AgentFillVerificationResult.Unavailable);
  });

  it("falls back to the master password when Touch ID throws", async () => {
    arrange({ biometrics: true, masterPassword: true });
    biometricsService.authenticateWithBiometrics.mockRejectedValue(new Error("boom"));

    expect(await service.verify()).toBe(AgentFillVerificationResult.Failed);
  });

  it("verifies a correct master password", async () => {
    userVerificationService.verifyUser.mockResolvedValue(true);

    expect(await service.verify("hunter2")).toBe(AgentFillVerificationResult.Verified);
    expect(userVerificationService.verifyUser).toHaveBeenCalledWith({
      type: VerificationType.MasterPassword,
      secret: "hunter2",
    });
    expect(biometricsService.authenticateWithBiometrics).not.toHaveBeenCalled();
  });

  it("fails a wrong master password, whether it throws or returns false", async () => {
    userVerificationService.verifyUser.mockRejectedValueOnce(new Error("Invalid"));
    expect(await service.verify("wrong")).toBe(AgentFillVerificationResult.Failed);

    userVerificationService.verifyUser.mockResolvedValueOnce(false);
    expect(await service.verify("wrong")).toBe(AgentFillVerificationResult.Failed);
  });

  it("fails an empty master password without checking it", async () => {
    expect(await service.verify("")).toBe(AgentFillVerificationResult.Failed);
    expect(userVerificationService.verifyUser).not.toHaveBeenCalled();
  });

  it("verifies again on every call", async () => {
    arrange({ biometrics: true, masterPassword: true });

    await service.verify();
    await service.verify();

    expect(biometricsService.authenticateWithBiometrics).toHaveBeenCalledTimes(2);
  });
});
