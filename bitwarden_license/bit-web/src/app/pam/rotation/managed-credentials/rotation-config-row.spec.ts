import type { RotationConfigView } from "../rotation";
import {
  CIPHER_ID,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfigView,
  targetSystemView,
} from "../testing/rotation-builders";

import {
  SCHEDULE_NONE_KEY,
  buildRotationConfigRow,
  isScheduleI18nKey,
} from "./rotation-config-row";

/**
 * `buildRotationConfigRow` maps a config onto presentation: i18n keys, sortable columns, and the
 * SDK's already-decided actions.
 *
 * It deliberately decides nothing itself. Whether a config may rotate, and which preset its cron
 * matches, are the SDK's calls — covered by `rotation_config_actions` and `preset_for_cron` in
 * bitwarden-pam — and arrive here in the description. So the tests below assert the mapping and
 * the pass-through, not the rules.
 */
describe("buildRotationConfigRow", () => {
  const row = (
    config: Partial<RotationConfigView> = {},
    target = targetSystemView(),
    cipherName: string | undefined = "My Cipher",
    description = rotationConfigDescription(),
  ) => buildRotationConfigRow(rotationConfigView(config), target, cipherName, description);

  describe("naming", () => {
    it("uses the resolved cipher name", () => {
      expect(row().cipherName).toBe("My Cipher");
    });

    it("falls back to the cipher id when the vault read has not resolved a name", () => {
      expect(row({}, targetSystemView(), undefined).cipherName).toBe(CIPHER_ID);
    });

    it("prefers the resolved target system's name over the config's denormalized copy", () => {
      const target = targetSystemView({ name: "Resolved Name" });
      expect(row({ targetSystemName: "Stale Name" }, target).targetSystemName).toBe(
        "Resolved Name",
      );
    });

    /** The server denormalizes the name onto the config, so it can lag a rename. */
    it("falls back to the config's copy when the target system has not loaded", () => {
      expect(row({ targetSystemName: "My Target" }, undefined).targetSystemName).toBe("My Target");
    });
  });

  describe("status label", () => {
    it("reads active when enabled", () => {
      expect(row({ enabled: true }).statusLabelKey).toBe("pamRotationConfigStatusActive");
    });

    it("reads paused when disabled", () => {
      expect(row({ enabled: false }).statusLabelKey).toBe("pamRotationConfigStatusPaused");
    });
  });

  describe("schedule label", () => {
    it("maps a named preset to its i18n key", () => {
      const built = row({}, targetSystemView(), "C", rotationConfigDescription({
        schedulePreset: "daily",
      }));
      expect(built.scheduleLabelKeyOrCron).toBe("pamRotationScheduleDaily");
      expect(isScheduleI18nKey(built)).toBe(true);
    });

    it("maps no schedule to the none key", () => {
      const built = row({ scheduleCron: undefined }, targetSystemView(), "C",
        rotationConfigDescription({ schedulePreset: "none" }));
      expect(built.scheduleLabelKeyOrCron).toBe(SCHEDULE_NONE_KEY);
      expect(isScheduleI18nKey(built)).toBe(true);
    });

    /** A custom expression is shown verbatim — there is no key that describes it. */
    it("shows a custom expression as its raw cron", () => {
      const built = row({ scheduleCron: "0 */30 * * * ?" }, targetSystemView(), "C",
        rotationConfigDescription({ schedulePreset: "custom" }));
      expect(built.scheduleLabelKeyOrCron).toBe("0 */30 * * * ?");
      expect(isScheduleI18nKey(built)).toBe(false);
    });
  });

  describe("date columns", () => {
    it("exposes epoch milliseconds alongside the ISO string for sorting", () => {
      const iso = "2024-01-15T12:00:00Z";
      const built = row({ lastRotationAt: iso });
      expect(built.lastRotationAtMs).toBe(Date.parse(iso));
      expect(built.lastRotationAt).toBe(iso);
    });

    it("leaves the sort key null when the date is unset", () => {
      expect(row({ lastRotationAt: undefined }).lastRotationAtMs).toBeNull();
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
      const built = row({}, targetSystemView(), "C", rotationConfigDescription({ actions }));

      expect(built.canRotateNow).toBe(false);
      expect(built.canRecordManual).toBe(true);
      expect(built.mutationsLocked).toBe(true);
      expect(built.canPause).toBe(false);
      expect(built.canResume).toBe(true);
    });
  });

  describe("pass-through fields", () => {
    it("carries rotateOnAccessEnd", () => {
      expect(row({ rotateOnAccessEnd: true }).rotateOnAccessEnd).toBe(true);
    });

    it("carries awaitingManualRotation", () => {
      expect(row({ awaitingManualRotation: true }).awaitingManualRotation).toBe(true);
    });
  });
});
