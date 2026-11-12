import { mock } from "jest-mock-extended";

import type { RotationScheduleClient } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";

import { resolveRotationSchedule, scheduleWarning } from "./rotation-schedule";

describe("resolveRotationSchedule", () => {
  const schedule = mock<RotationScheduleClient>();

  beforeEach(() => {
    jest.resetAllMocks();
    schedule.cron_for_preset.mockImplementation((p) => (p === "daily" ? "0 0 0 * * ?" : undefined));
    schedule.preset_for_cron.mockReturnValue("custom");
    schedule.is_likely_quartz_cron.mockReturnValue(true);
  });

  it("resolves a preset through cron_for_preset, ignoring case", () => {
    expect(resolveRotationSchedule(schedule, " Daily ")).toEqual({
      cron: "0 0 0 * * ?",
      preset: "daily",
      likelyQuartz: true,
    });
  });

  it("resolves the none preset to no cron", () => {
    expect(resolveRotationSchedule(schedule, "none").cron).toBeUndefined();
  });

  it("passes a raw cron through and reports its preset", () => {
    const resolved = resolveRotationSchedule(schedule, "0 0 3 * * ?");
    expect(resolved).toEqual({ cron: "0 0 3 * * ?", preset: "custom", likelyQuartz: true });
    expect(schedule.cron_for_preset).not.toHaveBeenCalled();
  });

  it("keeps a cron that does not look like Quartz and only warns", () => {
    schedule.is_likely_quartz_cron.mockReturnValue(false);
    const resolved = resolveRotationSchedule(schedule, "*/5 * * * *");
    expect(resolved.cron).toBe("*/5 * * * *");
    expect(scheduleWarning(resolved)).toContain("does not look like");
  });

  it("refuses an empty or very long schedule", () => {
    expect(() => resolveRotationSchedule(schedule, " ")).toThrow(PamInputError);
    expect(() => resolveRotationSchedule(schedule, "x".repeat(201))).toThrow(PamInputError);
  });
});
