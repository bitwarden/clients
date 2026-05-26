export const AccessRuleKind = Object.freeze({
  HumanApproval: "human_approval",
  IpAllowlist: "ip_allowlist",
  TimeOfDay: "time_of_day",
  AllOf: "all_of",
} as const);
export type AccessRuleKind = (typeof AccessRuleKind)[keyof typeof AccessRuleKind];

export const DayOfWeek = Object.freeze({
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
} as const);
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

const DAYS_OF_WEEK: ReadonlySet<DayOfWeek> = new Set(Object.values(DayOfWeek));

export type TimeWindow = {
  days: DayOfWeek[];
  from: string;
  to: string;
};

export type AccessRule =
  | { kind: "human_approval" }
  | { kind: "ip_allowlist"; cidrs: string[] }
  | { kind: "time_of_day"; tz: string; windows: TimeWindow[] }
  | { kind: "all_of"; rules: AccessRule[] };

const get = (obj: Record<string, unknown>, key: string): unknown =>
  obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];

function parseTimeWindow(json: unknown): TimeWindow {
  if (json == null || typeof json !== "object") {
    throw new Error("Invalid access rule: time window is not an object");
  }
  const obj = json as Record<string, unknown>;
  const days = get(obj, "days");
  if (!Array.isArray(days)) {
    throw new Error("Invalid access rule: time window 'days' is not an array");
  }
  const typedDays = days.map((d): DayOfWeek => {
    if (typeof d !== "string" || !DAYS_OF_WEEK.has(d as DayOfWeek)) {
      throw new Error(`Invalid access rule: unknown day "${String(d)}"`);
    }
    return d as DayOfWeek;
  });
  return {
    days: typedDays,
    from: get(obj, "from") as string,
    to: get(obj, "to") as string,
  };
}

export function parseAccessRule(json: unknown): AccessRule {
  if (json == null || typeof json !== "object") {
    throw new Error("Invalid access rule: not an object");
  }
  const obj = json as Record<string, unknown>;
  const kind = get(obj, "kind");
  switch (kind) {
    case AccessRuleKind.HumanApproval:
      return { kind: "human_approval" };
    case AccessRuleKind.IpAllowlist:
      return { kind: "ip_allowlist", cidrs: get(obj, "cidrs") as string[] };
    case AccessRuleKind.TimeOfDay:
      return {
        kind: "time_of_day",
        tz: get(obj, "tz") as string,
        windows: (get(obj, "windows") as unknown[]).map(parseTimeWindow),
      };
    case AccessRuleKind.AllOf:
      return {
        kind: "all_of",
        rules: (get(obj, "rules") as unknown[]).map(parseAccessRule),
      };
    default:
      throw new Error(`Invalid access rule: unknown kind "${String(kind)}"`);
  }
}
