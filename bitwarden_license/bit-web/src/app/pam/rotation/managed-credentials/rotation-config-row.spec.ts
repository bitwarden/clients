import {
  RotationConfigResponse,
  TargetSystemMethod,
  TargetSystemResponse,
  TargetSystemStatus,
} from "@bitwarden/bit-pam";

import {
  SCHEDULE_NONE_KEY,
  buildRotationConfigRow,
  isScheduleI18nKey,
} from "./rotation-config-row";

function makeConfig(overrides: Partial<RotationConfigResponse> = {}): RotationConfigResponse {
  const raw = {
    Id: "cfg-1",
    CipherId: "cipher-1",
    TargetSystemId: "ts-1",
    TargetSystemName: "My Target",
    TargetSystemMethod: TargetSystemMethod.Automatic,
    AccountIdentity: "admin@example.com",
    TerminateSessions: false,
    ScheduleCron: null,
    RotateOnAccessEnd: false,
    Enabled: true,
    LastRotationAt: null,
    NextRotationAt: null,
    HasActiveJob: false,
    AwaitingManualRotation: false,
    ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v]),
    ),
  };
  return new RotationConfigResponse(raw);
}

function makeTarget(overrides: Partial<TargetSystemResponse> = {}): TargetSystemResponse {
  const raw = {
    Id: "ts-1",
    Name: "Test Target",
    Method: TargetSystemMethod.Automatic,
    Kind: 0,
    Status: TargetSystemStatus.Active,
    PasswordPolicy: null,
    SupportsSessionTermination: true,
    ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v]),
    ),
  };
  return new TargetSystemResponse(raw);
}

describe("buildRotationConfigRow", () => {
  it("uses resolved cipher name when provided", () => {
    const row = buildRotationConfigRow(makeConfig(), undefined, "My Cipher");
    expect(row.cipherName).toBe("My Cipher");
  });

  it("falls back to cipherId when cipher name is undefined", () => {
    const row = buildRotationConfigRow(makeConfig(), undefined, undefined);
    expect(row.cipherName).toBe("cipher-1");
  });

  it("uses resolved target system name when available", () => {
    const target = makeTarget({ name: "Resolved Name" } as any);
    const row = buildRotationConfigRow(makeConfig(), target, "Cipher");
    expect(row.targetSystemName).toBe("Resolved Name");
  });

  it("falls back to config.targetSystemName when target is undefined", () => {
    const row = buildRotationConfigRow(makeConfig(), undefined, "Cipher");
    expect(row.targetSystemName).toBe("My Target");
  });

  it("returns statusLabelKey 'pamRotationConfigStatusActive' when enabled", () => {
    const row = buildRotationConfigRow(makeConfig({ enabled: true } as any), undefined, "C");
    expect(row.statusLabelKey).toBe("pamRotationConfigStatusActive");
  });

  it("returns statusLabelKey 'pamRotationConfigStatusPaused' when disabled", () => {
    const row = buildRotationConfigRow(makeConfig({ enabled: false } as any), undefined, "C");
    expect(row.statusLabelKey).toBe("pamRotationConfigStatusPaused");
  });

  it("maps null scheduleCron to the none label key", () => {
    const row = buildRotationConfigRow(makeConfig({ scheduleCron: null } as any), undefined, "C");
    expect(row.scheduleLabelKeyOrCron).toBe(SCHEDULE_NONE_KEY);
    expect(isScheduleI18nKey(row)).toBe(true);
  });

  it("maps daily preset cron to i18n key", () => {
    const row = buildRotationConfigRow(
      makeConfig({ scheduleCron: "0 0 0 * * ?" } as any),
      undefined,
      "C",
    );
    expect(row.scheduleLabelKeyOrCron).toBe("pamRotationScheduleDaily");
    expect(isScheduleI18nKey(row)).toBe(true);
  });

  it("maps custom cron to the raw string", () => {
    const row = buildRotationConfigRow(
      makeConfig({ scheduleCron: "0 */30 * * * ?" } as any),
      undefined,
      "C",
    );
    expect(row.scheduleLabelKeyOrCron).toBe("0 */30 * * * ?");
    expect(isScheduleI18nKey(row)).toBe(false);
  });

  it("computes lastRotationAtMs as epoch ms when date is set", () => {
    const iso = "2024-01-15T12:00:00Z";
    const row = buildRotationConfigRow(makeConfig({ lastRotationAt: iso } as any), undefined, "C");
    expect(row.lastRotationAtMs).toBe(Date.parse(iso));
    expect(row.lastRotationAt).toBe(iso);
  });

  it("sets lastRotationAtMs to null when lastRotationAt is null", () => {
    const row = buildRotationConfigRow(makeConfig({ lastRotationAt: null } as any), undefined, "C");
    expect(row.lastRotationAtMs).toBeNull();
  });

  it("sets canRotateNow true for automatic + active + enabled + no active job", () => {
    const target = makeTarget({ status: TargetSystemStatus.Active } as any);
    const row = buildRotationConfigRow(makeConfig(), target, "C");
    expect(row.canRotateNow).toBe(true);
  });

  it("sets canRotateNow false when hasActiveJob", () => {
    const target = makeTarget({ status: TargetSystemStatus.Active } as any);
    const row = buildRotationConfigRow(makeConfig({ hasActiveJob: true } as any), target, "C");
    expect(row.canRotateNow).toBe(false);
  });

  it("sets canRotateNow false when target is undefined", () => {
    const row = buildRotationConfigRow(makeConfig(), undefined, "C");
    expect(row.canRotateNow).toBe(false);
  });

  it("sets canRecordManual true for Manual method", () => {
    const row = buildRotationConfigRow(
      makeConfig({ targetSystemMethod: TargetSystemMethod.Manual } as any),
      undefined,
      "C",
    );
    expect(row.canRecordManual).toBe(true);
  });

  it("sets canRecordManual false for Automatic method", () => {
    const row = buildRotationConfigRow(makeConfig(), undefined, "C");
    expect(row.canRecordManual).toBe(false);
  });

  it("sets mutationsLocked true when hasActiveJob", () => {
    const row = buildRotationConfigRow(makeConfig({ hasActiveJob: true } as any), undefined, "C");
    expect(row.mutationsLocked).toBe(true);
  });

  it("sets canPause true when enabled", () => {
    const row = buildRotationConfigRow(makeConfig({ enabled: true } as any), undefined, "C");
    expect(row.canPause).toBe(true);
  });

  it("sets canResume true when disabled", () => {
    const row = buildRotationConfigRow(makeConfig({ enabled: false } as any), undefined, "C");
    expect(row.canResume).toBe(true);
  });

  it("passes through rotateOnAccessEnd", () => {
    const row = buildRotationConfigRow(
      makeConfig({ rotateOnAccessEnd: true } as any),
      undefined,
      "C",
    );
    expect(row.rotateOnAccessEnd).toBe(true);
  });

  it("passes through awaitingManualRotation", () => {
    const row = buildRotationConfigRow(
      makeConfig({ awaitingManualRotation: true } as any),
      undefined,
      "C",
    );
    expect(row.awaitingManualRotation).toBe(true);
  });
});
