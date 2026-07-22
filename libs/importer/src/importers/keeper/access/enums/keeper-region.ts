export const KeeperRegion = Object.freeze({
  Us: "keepersecurity.com",
  Eu: "keepersecurity.eu",
  Au: "keepersecurity.com.au",
  Ca: "keepersecurity.ca",
  Jp: "keepersecurity.jp",
  UsGov: "govcloud.keepersecurity.us",
} as const);
export type KeeperRegion = (typeof KeeperRegion)[keyof typeof KeeperRegion];
