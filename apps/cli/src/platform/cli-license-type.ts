/**
 * The license the running CLI build was produced under. The values match the `bw-{license}-*`
 * prefix of the CLI release assets.
 */
export const CliLicenseType = Object.freeze({
  /** Built from `apps/cli` (GPL). */
  Oss: "oss",
  /** Built from `bitwarden_license/bit-cli` (Bitwarden License). */
  Bit: "bit",
} as const);
export type CliLicenseType = (typeof CliLicenseType)[keyof typeof CliLicenseType];
