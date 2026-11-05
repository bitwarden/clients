/**
 * DevTools performance track groups, i.e. the domain or flow a measurement belongs to.
 * Shared so entries from different services land in the same group, e.g. `"Unlock"`.
 */
export const PerfTrackGroup = Object.freeze({
  Crypto: "Crypto",
  KeyManagement: "KeyManagement",
  Migrations: "Migrations",
  Notifications: "Notifications",
  Sdk: "SDK",
  Search: "Search",
  Sync: "Sync",
  Unlock: "Unlock",
} as const);

export type PerfTrackGroup = (typeof PerfTrackGroup)[keyof typeof PerfTrackGroup];
