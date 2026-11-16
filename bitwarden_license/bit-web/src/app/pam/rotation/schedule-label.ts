import { QuartzSchedulePreset } from "./rotation";
import {
  parseIntervalCron,
  ScheduleIntervalUnit,
  timeOfDay,
} from "./rotation-schedule-input/rotation-schedule";

/**
 * Reading a Quartz schedule back to a person.
 *
 * The managed credentials table describes a schedule with the same decoding the schedule input
 * uses to load an expression into its interval builder (`parseIntervalCron`). Neither renders a
 * raw expression as a label: an expression is how a schedule is written down, not what it says.
 */

/** Preset → its short label, the one a table column has room for. */
const PRESET_LABEL_KEYS: Readonly<Record<QuartzSchedulePreset, string>> = Object.freeze({
  [QuartzSchedulePreset.None]: "pamRotationScheduleNone",
  [QuartzSchedulePreset.Hourly]: "pamRotationScheduleHourly",
  [QuartzSchedulePreset.Every6Hours]: "pamRotationScheduleEvery6Hours",
  [QuartzSchedulePreset.Daily]: "pamRotationScheduleDaily",
  [QuartzSchedulePreset.Weekly]: "pamRotationScheduleWeekly",
  [QuartzSchedulePreset.Monthly]: "pamRotationScheduleMonthly",
  [QuartzSchedulePreset.Custom]: "pamRotationScheduleCustom",
});

/**
 * Interval unit → the short column labels.
 *
 * Shorter than the schedule input's echo sentences: the echo has a paragraph's room beneath the
 * control and says "Rotates every 3 days, at 03:00.", where a column cell has one line and says
 * "Every 3 days at 03:00".
 */
const INTERVAL_COLUMN_KEYS: Readonly<Record<ScheduleIntervalUnit, { one: string; many: string }>> =
  Object.freeze({
    [ScheduleIntervalUnit.Days]: {
      one: "pamRotationScheduleColumnEveryDayUtc",
      many: "pamRotationScheduleColumnEveryNDaysUtc",
    },
    [ScheduleIntervalUnit.Months]: {
      one: "pamRotationScheduleColumnEveryMonthUtc",
      many: "pamRotationScheduleColumnEveryNMonthsUtc",
    },
  });

/** A resolved schedule label: one message key, its substitutions, and the cron behind it. */
export type ScheduleLabel = {
  /** i18n key of the label. Always set, so a cell is never blank. */
  key: string;
  /** The `$1`, `$2` substitutions {@link key} takes, in order. Empty when it takes none. */
  placeholders: readonly string[];
  /**
   * The expression the label could not spell out, for a tooltip, or `null` when it could.
   *
   * Only a hand-written expression sets this: an operator who wrote one still needs to see it,
   * and "Custom" alone would lose it.
   */
  rawCron: string | null;
};

function simpleLabel(key: string): ScheduleLabel {
  return { key, placeholders: [], rawCron: null };
}

/**
 * Resolve a schedule to the label that describes it.
 *
 * Order of resolution:
 * 1. A preset the SDK named wins, and renders as that preset's short label.
 * 2. Failing that, an expression the interval builder could have composed renders as the interval
 *    it describes, with its count and time of day.
 * 3. Failing that, the expression is hand-written: it renders as "Custom" and travels on in
 *    {@link ScheduleLabel.rawCron} for a tooltip.
 *
 * An absent expression is no schedule whatever preset accompanies it, since nothing will run.
 *
 * @param preset - The preset the SDK matched this config's expression to.
 * @param cron - The config's Quartz expression, if it has one.
 */
export function resolveScheduleLabel(
  preset: QuartzSchedulePreset,
  cron: string | null | undefined,
): ScheduleLabel {
  const expression = cron?.trim() ?? "";

  // Typed wider than the table, so a preset the SDK adds ahead of this table decodes its cron
  // rather than resolving to a blank key.
  const presetKey: string | undefined = PRESET_LABEL_KEYS[preset];
  if (preset !== QuartzSchedulePreset.Custom && presetKey != null) {
    return simpleLabel(presetKey);
  }

  if (expression === "") {
    return simpleLabel(PRESET_LABEL_KEYS[QuartzSchedulePreset.None]);
  }

  const interval = parseIntervalCron(expression);
  if (interval != null) {
    const keys = INTERVAL_COLUMN_KEYS[interval.unit];
    const time = timeOfDay(interval.hh, interval.mm);
    return interval.count === 1
      ? { key: keys.one, placeholders: [time], rawCron: null }
      : {
          key: keys.many,
          placeholders: [String(interval.count), time],
          rawCron: null,
        };
  }

  return {
    key: PRESET_LABEL_KEYS[QuartzSchedulePreset.Custom],
    placeholders: [],
    rawCron: expression,
  };
}
