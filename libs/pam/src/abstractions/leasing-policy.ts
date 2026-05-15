export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimeWindow = {
  daysOfWeek: DayOfWeek[];
  from: string;
  to: string;
};

export type LeasingPolicy =
  | { kind: "human_approval" }
  | { kind: "ip_allowlist"; cidrs: string[] }
  | { kind: "time_of_day"; windows: TimeWindow[]; tz: string }
  | { kind: "all_of"; children: LeasingPolicy[] };

const get = (obj: Record<string, unknown>, key: string): unknown =>
  obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)];

export function parseLeasingPolicy(json: unknown): LeasingPolicy {
  if (json == null || typeof json !== "object") {
    throw new Error("Invalid leasing policy: not an object");
  }
  const obj = json as Record<string, unknown>;
  const kind = get(obj, "kind");
  switch (kind) {
    case "human_approval":
      return { kind: "human_approval" };
    case "ip_allowlist":
      return { kind: "ip_allowlist", cidrs: get(obj, "cidrs") as string[] };
    case "time_of_day":
      return {
        kind: "time_of_day",
        windows: get(obj, "windows") as TimeWindow[],
        tz: get(obj, "tz") as string,
      };
    case "all_of":
      return {
        kind: "all_of",
        children: (get(obj, "children") as unknown[]).map(parseLeasingPolicy),
      };
    default:
      throw new Error(`Invalid leasing policy: unknown kind "${String(kind)}"`);
  }
}
