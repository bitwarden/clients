import { Opaque } from "type-fest";

export const IntegrationIds = [
  "anonaddy",
  "duckduckgo",
  "fastmail",
  "firefoxrelay",
  "forwardemail",
  "simplelogin",
  "skudo",
] as const;

/** Identifies a vendor integrated into bitwarden */
export type IntegrationId = Opaque<string, "IntegrationId">;
