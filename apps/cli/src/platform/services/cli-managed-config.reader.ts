import { win32 } from "path";

import { readSecureManagedConfigDir } from "@bitwarden/node/managed-settings/secure-config-dir";

interface Logger {
  warning(message: string): void;
}

/** Reads the system-wide managed-config directory for the current OS. */
export function readCliManagedConfig(
  platform: NodeJS.Platform,
  logger: Logger,
): Record<string, unknown> {
  // Canonical ProgramData; do not trust process.env.ProgramData (user-settable -> spoofable).
  const dir =
    platform === "win32"
      ? win32.join("C:\\ProgramData", "Bitwarden", "policies")
      : "/etc/bitwarden/policies";
  return readSecureManagedConfigDir(dir, platform, logger);
}
