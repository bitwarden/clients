import type { AccessConnector, RotationConfigView, TargetSystemView } from "../rotation";
import type { RotationConfigDescription } from "../rotation-sdk.service";
import {
  CIPHER_ID,
  TARGET_SYSTEM_ID,
  accessConnector,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfig,
  rotationConfigSealedFields,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";

import {
  ROTATION_STATUS_BADGES,
  RotationRowStatus,
  buildRotationConfigRow,
  rotationStatusBadge,
} from "./rotation-config-row";

/** The SDK decides the rules, so these tests cover the mapping and pass-through only. */
describe("buildRotationConfigRow", () => {
  /**
   * An options object, so a test can pass an explicit `undefined` target or cipher name, which a
   * default parameter would fill back in.
   */
  const row = (
    options: {
      config?: Partial<RotationConfigView>;
      target?: TargetSystemView;
      cipherName?: string;
      description?: RotationConfigDescription;
      connectors?: AccessConnector[] | null;
    } = {},
  ) =>
    buildRotationConfigRow(
      rotationConfig(options.config ?? {}),
      "target" in options ? options.target : targetSystem(),
      "cipherName" in options ? options.cipherName : "My Cipher",
      options.description ?? rotationConfigDescription(),
      "connectors" in options
        ? options.connectors
        : [accessConnector({ assignedTargetSystemIds: [TARGET_SYSTEM_ID] })],
    );

  describe("naming", () => {
    it("uses the resolved cipher name", () => {
      expect(row().cipherName).toBe("My Cipher");
    });

    it("falls back to the cipher id when the vault read has not resolved a name", () => {
      expect(row({ cipherName: undefined }).cipherName).toBe(CIPHER_ID);
    });

    it("prefers the resolved target system's name over the config's denormalized copy", () => {
      const target = targetSystem({ name: "Resolved Name" });
      expect(row({ config: { targetSystemName: "Stale Name" }, target }).targetSystemName).toBe(
        "Resolved Name",
      );
    });

    /** The server denormalizes the name onto the config, so it can lag a rename. */
    it("falls back to the config's copy when the target system has not loaded", () => {
      expect(
        row({ config: { targetSystemName: "My Target" }, target: undefined }).targetSystemName,
      ).toBe("My Target");
    });
  });

  describe("resolved status", () => {
    const manual = { targetSystemMethod: "manual" } as const;

    it("reads active for an enabled, idle automatic credential", () => {
      const built = row({ config: { enabled: true } });
      expect(built.status).toBe(RotationRowStatus.Active);
      expect(built.statusBadge.labelKey).toBe("active");
      expect(built.statusBadge.variant).toBe("success");
      expect(built.statusBadge.icon).toBe("bwi-check-circle");
    });

    it("reads paused when disabled", () => {
      const built = row({ config: { enabled: false } });
      expect(built.status).toBe(RotationRowStatus.Paused);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigStatusPaused");
      expect(built.statusBadge.variant).toBe("subtle");
      expect(built.statusBadge.icon).toBe("bwi-pause-circle");
    });

    it("reads rotating while a job is in flight", () => {
      const built = row({ config: { hasActiveJob: true } });
      expect(built.status).toBe(RotationRowStatus.Rotating);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigRotatingBadge");
      expect(built.statusBadge.variant).toBe("primary");
      expect(built.statusBadge.icon).toBe("bwi-refresh");
    });

    it("reads rotation due for a manual credential awaiting confirmation", () => {
      const built = row({ config: { ...manual, awaitingManualRotation: true } });
      expect(built.status).toBe(RotationRowStatus.RotationDue);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigRotationDueBadge");
      expect(built.statusBadge.variant).toBe("warning");
      expect(built.statusBadge.icon).toBe("bwi-calendar");
    });

    it("reads manual rotation for a manual credential that is not yet due", () => {
      const built = row({ config: { ...manual, awaitingManualRotation: false } });
      expect(built.status).toBe(RotationRowStatus.ManualRotation);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigStatusManualRotation");
      expect(built.statusBadge.variant).toBe("subtle");
      expect(built.statusBadge.icon).toBe("bwi-user");
    });

    it("never reads an automatic credential as rotation due", () => {
      expect(row({ config: { awaitingManualRotation: true } }).status).toBe(
        RotationRowStatus.Active,
      );
    });

    it("prefers rotating over paused, so a paused credential mid-rotation shows one badge", () => {
      expect(
        row({ config: { enabled: false, hasActiveJob: true, awaitingManualRotation: true } })
          .status,
      ).toBe(RotationRowStatus.Rotating);
    });

    it("prefers paused over rotation due, so no cycle is implied while stopped", () => {
      expect(
        row({ config: { ...manual, enabled: false, awaitingManualRotation: true } }).status,
      ).toBe(RotationRowStatus.Paused);
    });

    it("carries the badge's label key as the status label key", () => {
      const built = row({ config: { hasActiveJob: true } });
      expect(built.statusLabelKey).toBe(built.statusBadge.labelKey);
    });
  });

  describe("not connected", () => {
    const target = TARGET_SYSTEM_ID;
    const connector = (overrides: Partial<AccessConnector> = {}) =>
      accessConnector({ assignedTargetSystemIds: [target], ...overrides });

    it("reads not connected for an automatic credential whose target has no connected connector", () => {
      const built = row({ connectors: [connector({ isConnected: false })] });
      expect(built.status).toBe(RotationRowStatus.NotConnected);
      expect(built.notConnected).toBe(true);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigStatusNotConnected");
      expect(built.statusBadge.variant).toBe("warning");
      expect(built.statusBadge.icon).toBe("bwi-warning");
    });

    it("counts a target with no assigned connectors as not connected", () => {
      expect(row({ connectors: [] }).status).toBe(RotationRowStatus.NotConnected);
    });

    it("counts only connectors assigned to the credential's own target", () => {
      const other = connector({ assignedTargetSystemIds: [sysId("other")] });
      expect(row({ connectors: [other] }).status).toBe(RotationRowStatus.NotConnected);
    });

    it("does not count a disabled connector, which cannot claim jobs", () => {
      const built = row({ connectors: [connector({ status: "disabled" as never })] });
      expect(built.status).toBe(RotationRowStatus.NotConnected);
    });

    it("reads active once an enabled, connected connector is assigned", () => {
      expect(row({ connectors: [connector()] }).status).toBe(RotationRowStatus.Active);
    });

    it("treats unknown connectivity as connected rather than guessing", () => {
      expect(row({ connectors: null }).status).toBe(RotationRowStatus.Active);
    });

    it("never marks a manual credential not connected", () => {
      const built = row({ config: { targetSystemMethod: "manual" }, connectors: [] });
      expect(built.status).toBe(RotationRowStatus.ManualRotation);
    });

    it("lets paused and rotating outrank it", () => {
      expect(row({ config: { enabled: false }, connectors: [] }).status).toBe(
        RotationRowStatus.Paused,
      );
      expect(row({ config: { hasActiveJob: true }, connectors: [] }).status).toBe(
        RotationRowStatus.Rotating,
      );
    });
  });

  /** Sorting on `statusLabelKey` would order rows by the spelling of an i18n identifier. */
  describe("status sort order", () => {
    it("ranks the statuses by urgency, not by precedence", () => {
      expect(ROTATION_STATUS_BADGES.map((badge) => badge.status)).toEqual([
        RotationRowStatus.NotConnected,
        RotationRowStatus.RotationDue,
        RotationRowStatus.Rotating,
        RotationRowStatus.Paused,
        RotationRowStatus.ManualRotation,
        RotationRowStatus.Active,
      ]);
    });

    it("sorts ascending from the most attention-worthy status to the steady state", () => {
      const rows = [
        row({ config: { enabled: true } }),
        row({ config: { targetSystemMethod: "manual", awaitingManualRotation: true } }),
        row({ config: { hasActiveJob: true } }),
        row({ config: { enabled: false } }),
        row({ config: { targetSystemMethod: "manual" } }),
        row({ connectors: [] }),
      ];

      const sorted = [...rows].sort((a, b) => a.statusSortOrder - b.statusSortOrder);

      expect(sorted.map((r) => r.status)).toEqual([
        RotationRowStatus.NotConnected,
        RotationRowStatus.RotationDue,
        RotationRowStatus.Rotating,
        RotationRowStatus.Paused,
        RotationRowStatus.ManualRotation,
        RotationRowStatus.Active,
      ]);
    });

    it("gives each status a distinct rank, Failed included", () => {
      expect(rotationStatusBadge(RotationRowStatus.Failed).sortOrder).toBe(1);
      const orders = Object.values(RotationRowStatus).map(
        (status) => rotationStatusBadge(status).sortOrder,
      );
      expect(new Set(orders).size).toBe(7);
    });

    it("withholds Failed from the filter's options, since nothing can derive it yet", () => {
      expect(ROTATION_STATUS_BADGES.map((badge) => badge.status)).not.toContain(
        RotationRowStatus.Failed,
      );
    });
  });

  describe("account", () => {
    it("carries the sealed account identity", () => {
      const built = row({
        config: { sealed: rotationConfigSealedFields({ accountIdentity: "oracle_dba" }) },
      });
      expect(built.accountIdentity).toBe("oracle_dba");
    });

    it("is null when the sealed fields failed verification", () => {
      expect(row({ config: { sealed: undefined } }).accountIdentity).toBeNull();
    });
  });

  describe("next rotation", () => {
    const iso = "2030-01-01T00:00:00Z";

    it("is in progress while a job runs, even with a time scheduled", () => {
      const built = row({ config: { hasActiveJob: true, nextRotationAt: iso } });
      expect(built.nextRotation).toEqual({ kind: "in-progress" });
    });

    it("is none for a paused credential, even with a time scheduled", () => {
      const built = row({ config: { enabled: false, nextRotationAt: iso } });
      expect(built.nextRotation).toEqual({ kind: "none" });
    });

    it("is none when nothing is scheduled", () => {
      expect(row({ config: { nextRotationAt: undefined } }).nextRotation).toEqual({
        kind: "none",
      });
    });

    it("carries the scheduled time otherwise", () => {
      expect(row({ config: { nextRotationAt: iso } }).nextRotation).toEqual({
        kind: "at",
        ms: Date.parse(iso),
      });
    });
  });

  describe("schedule label", () => {
    it("maps a named preset to its i18n key", () => {
      const built = row({ description: rotationConfigDescription({ schedulePreset: "daily" }) });
      expect(built.scheduleLabelKeyOrCron).toBe("pamRotationScheduleDaily");
    });

    it("maps no schedule to the none key", () => {
      const built = row({
        config: { scheduleCron: undefined },
        description: rotationConfigDescription({ schedulePreset: "none" }),
      });
      expect(built.scheduleLabelKeyOrCron).toBe("pamRotationScheduleNone");
    });

    /** No key describes a custom expression, so it shows verbatim. */
    it("shows a custom expression as its raw cron", () => {
      const built = row({
        config: { scheduleCron: "0 */30 * * * ?" },
        description: rotationConfigDescription({ schedulePreset: "custom" }),
      });
      expect(built.scheduleLabelKeyOrCron).toBe("0 */30 * * * ?");
    });
  });

  describe("date columns", () => {
    it("exposes epoch milliseconds alongside the ISO string for sorting", () => {
      const iso = "2024-01-15T12:00:00Z";
      const built = row({ config: { lastRotationAt: iso } });
      expect(built.lastRotationAtMs).toBe(Date.parse(iso));
      expect(built.lastRotationAt).toBe(iso);
    });

    it("leaves the sort key null when the date is unset", () => {
      expect(row({ config: { lastRotationAt: undefined } }).lastRotationAtMs).toBeNull();
    });
  });

  describe("actions", () => {
    /** Uses a combination the row couldn't derive itself, so recomputing would fail this. */
    it("carries the SDK's verdict through unchanged", () => {
      const actions = rotationConfigActions({
        canRotateNow: false,
        canRecordManual: true,
        mutationsLocked: true,
        canPause: false,
        canResume: true,
      });
      const built = row({ description: rotationConfigDescription({ actions }) });

      expect(built.canRotateNow).toBe(false);
      expect(built.canRecordManual).toBe(true);
      expect(built.mutationsLocked).toBe(true);
      expect(built.canPause).toBe(false);
      expect(built.canResume).toBe(true);
    });
  });

  describe("pass-through fields", () => {
    it("carries rotateOnAccessEnd", () => {
      expect(row({ config: { rotateOnAccessEnd: true } }).rotateOnAccessEnd).toBe(true);
    });

    it("carries awaitingManualRotation", () => {
      expect(row({ config: { awaitingManualRotation: true } }).awaitingManualRotation).toBe(true);
    });
  });
});
