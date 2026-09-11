import type { RotationConfig, TargetSystem } from "../rotation";
import type { RotationConfigDescription } from "../rotation-sdk.service";
import {
  CIPHER_ID,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfig,
  targetSystem,
} from "../testing/rotation-builders";

import { RotationRowStatus, buildRotationConfigRow } from "./rotation-config-row";

/**
 * `buildRotationConfigRow` maps a config onto presentation: i18n keys, sortable columns, and the
 * SDK's already-decided actions.
 *
 * Decides nothing itself — whether a config may rotate and which preset its cron matches are
 * the SDK's calls, arriving here in the description — so these tests assert the mapping and
 * pass-through, not the rules.
 */
describe("buildRotationConfigRow", () => {
  /**
   * Takes an options object rather than positional arguments so a test can pass an explicit
   * `undefined` for the target or the cipher name — the two "not loaded yet" cases — which a
   * default parameter would silently fill back in.
   */
  const row = (
    options: {
      config?: Partial<RotationConfig>;
      target?: TargetSystem;
      cipherName?: string;
      description?: RotationConfigDescription;
    } = {},
  ) =>
    buildRotationConfigRow(
      rotationConfig(options.config ?? {}),
      "target" in options ? options.target : targetSystem(),
      "cipherName" in options ? options.cipherName : "My Cipher",
      options.description ?? rotationConfigDescription(),
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
    it("reads active when enabled, idle, and not awaiting a manual rotation", () => {
      const built = row({ config: { enabled: true } });
      expect(built.status).toBe(RotationRowStatus.Active);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigStatusActive");
      expect(built.statusBadge.variant).toBe("success");
      expect(built.statusBadge.icon).toBe("bwi-check-circle");
    });

    it("reads paused when disabled", () => {
      const built = row({ config: { enabled: false } });
      expect(built.status).toBe(RotationRowStatus.Paused);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigStatusPaused");
      expect(built.statusBadge.variant).toBe("subtle");
      expect(built.statusBadge.icon).toBe("bwi-minus-circle");
    });

    it("reads rotating while a job is in flight", () => {
      const built = row({ config: { hasActiveJob: true } });
      expect(built.status).toBe(RotationRowStatus.Rotating);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigRotatingBadge");
      expect(built.statusBadge.variant).toBe("primary");
      expect(built.statusBadge.icon).toBe("bwi-refresh");
    });

    it("reads manual rotation while awaiting an operator's confirmation", () => {
      const built = row({ config: { awaitingManualRotation: true } });
      expect(built.status).toBe(RotationRowStatus.ManualRotation);
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigRotationDueBadge");
      expect(built.statusBadge.variant).toBe("warning");
      expect(built.statusBadge.icon).toBe("bwi-clock");
    });

    it("prefers rotating over paused, so an in-flight job stays visible", () => {
      expect(
        row({ config: { enabled: false, hasActiveJob: true, awaitingManualRotation: true } })
          .status,
      ).toBe(RotationRowStatus.Rotating);
    });

    it("prefers paused over manual rotation, so no cycle is implied while stopped", () => {
      expect(row({ config: { enabled: false, awaitingManualRotation: true } }).status).toBe(
        RotationRowStatus.Paused,
      );
    });

    it("carries the badge's label key as the status filter's value", () => {
      const built = row({ config: { hasActiveJob: true } });
      expect(built.statusLabelKey).toBe(built.statusBadge.labelKey);
    });
  });

  /**
   * The column used to sort on `statusLabelKey`, which ordered rows by the spelling of an i18n
   * identifier: "pamRotationConfigInProgress" ahead of "pamRotationConfigStatusActive" for no
   * reason a reader of the rendered labels could see.
   */
  describe("status sort order", () => {
    const orderOf = (config: Partial<RotationConfig>) => row({ config }).statusSortOrder;

    it("ranks the statuses by resolveRotationStatus's precedence", () => {
      expect(orderOf({ hasActiveJob: true })).toBe(1);
      expect(orderOf({ enabled: false })).toBe(2);
      expect(orderOf({ awaitingManualRotation: true })).toBe(3);
      expect(orderOf({ enabled: true })).toBe(4);
    });

    it("sorts ascending from the most attention-worthy status to the steady state", () => {
      const rows = [
        row({ config: { enabled: true } }),
        row({ config: { awaitingManualRotation: true } }),
        row({ config: { hasActiveJob: true } }),
        row({ config: { enabled: false } }),
      ];

      const sorted = [...rows].sort((a, b) => a.statusSortOrder - b.statusSortOrder);

      expect(sorted.map((r) => r.status)).toEqual([
        RotationRowStatus.Rotating,
        RotationRowStatus.Paused,
        RotationRowStatus.ManualRotation,
        RotationRowStatus.Active,
      ]);
    });

    it("gives each status a distinct rank, so no two collapse together", () => {
      const orders = [
        orderOf({ hasActiveJob: true }),
        orderOf({ enabled: false }),
        orderOf({ awaitingManualRotation: true }),
        orderOf({ enabled: true }),
      ];
      expect(new Set(orders).size).toBe(4);
    });

    it("takes the rank from the resolved status, not from the pause a rotating row also carries", () => {
      const built = row({ config: { enabled: false, hasActiveJob: true } });
      expect(built.pausedWhileRotating).toBe(true);
      expect(built.statusSortOrder).toBe(orderOf({ hasActiveJob: true }));
    });
  });

  /**
   * Only removal is gated on an in-flight job, so a config can be paused and mid-rotation at once.
   * The status badge shows the rotation; this flag is what keeps the pause visible.
   */
  describe("paused while rotating", () => {
    it("flags a paused config whose claimed job is still running", () => {
      const built = row({ config: { enabled: false, hasActiveJob: true } });
      expect(built.status).toBe(RotationRowStatus.Rotating);
      expect(built.pausedWhileRotating).toBe(true);
    });

    it("leaves the status column's sort and filter value on the resolved status", () => {
      const built = row({ config: { enabled: false, hasActiveJob: true } });
      expect(built.statusLabelKey).toBe("pamRotationConfigInProgress");
      expect(built.statusBadge.labelKey).toBe("pamRotationConfigInProgress");
    });

    it("does not flag a paused config with no job in flight, whose badge already says paused", () => {
      const built = row({ config: { enabled: false, hasActiveJob: false } });
      expect(built.status).toBe(RotationRowStatus.Paused);
      expect(built.pausedWhileRotating).toBe(false);
    });

    it("does not flag an enabled config that is mid-rotation", () => {
      expect(row({ config: { enabled: true, hasActiveJob: true } }).pausedWhileRotating).toBe(false);
    });

    it("does not flag a steady-state active config", () => {
      expect(row({ config: { enabled: true, hasActiveJob: false } }).pausedWhileRotating).toBe(
        false,
      );
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

    /** A custom expression is shown verbatim — there is no key that describes it. */
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
    /**
     * The five flags are the SDK's verdict, so the row must carry them through rather than
     * recompute — including a combination the row could not have derived itself.
     */
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
