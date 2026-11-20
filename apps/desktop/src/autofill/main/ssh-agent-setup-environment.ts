import { promises as fs } from "fs";
import * as path from "path";

import {
  isFlatpak,
  isMacAppStore,
  isSnapStore,
  isWindowsStore,
} from "../../main/platform-utils.main";
import {
  SshAgentSetupMode,
  SshAgentSetupPackaging,
  SshAgentSetupPlatform,
} from "../models/ssh-agent-setup";

export const SSH_SETUP_HOME_OVERRIDE_ENV = "BITWARDEN_SSH_SETUP_HOME";

export const SshSetupShell = Object.freeze({
  Zsh: "zsh",
  Bash: "bash",
  Fish: "fish",
} as const);
export type SshSetupShell = (typeof SshSetupShell)[keyof typeof SshSetupShell];

export interface SetupHome {
  home: string;
  /** True when BITWARDEN_SSH_SETUP_HOME is in effect (development and tests only). */
  overridden: boolean;
}

/**
 * Resolves the home directory used for every read and write. `BITWARDEN_SSH_SETUP_HOME` is only
 * honoured in development builds and tests. `process.env.NODE_ENV` is referenced literally so
 * webpack replaces it with a constant in production bundles, making the override unreachable.
 */
export function resolveSetupHome(defaultHome: string): SetupHome {
  const devOrTest = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const override = process.env[SSH_SETUP_HOME_OVERRIDE_ENV];
  if (devOrTest && override != null && override !== "" && path.isAbsolute(override)) {
    return { home: path.resolve(override), overridden: true };
  }
  return { home: defaultHome, overridden: false };
}

export function detectPlatform(platform: NodeJS.Platform): SshAgentSetupPlatform | null {
  switch (platform) {
    case "darwin":
      return SshAgentSetupPlatform.Mac;
    case "linux":
      return SshAgentSetupPlatform.Linux;
    case "win32":
      return SshAgentSetupPlatform.Windows;
    default:
      return null;
  }
}

export function detectPackaging(): SshAgentSetupPackaging {
  if (isMacAppStore()) {
    return SshAgentSetupPackaging.MacAppStore;
  }
  if (isSnapStore()) {
    return SshAgentSetupPackaging.Snap;
  }
  if (isFlatpak()) {
    return SshAgentSetupPackaging.Flatpak;
  }
  if (isWindowsStore()) {
    return SshAgentSetupPackaging.WindowsStore;
  }
  return SshAgentSetupPackaging.Standard;
}

export interface SetupModeDecision {
  mode: SshAgentSetupMode;
  guidedReasonKey?: string;
}

/** Automatic only for macOS/Linux standard packages. Everything else is guided. */
export function decideMode(
  platform: SshAgentSetupPlatform | null,
  packaging: SshAgentSetupPackaging,
): SetupModeDecision {
  switch (packaging) {
    case SshAgentSetupPackaging.MacAppStore:
      return { mode: SshAgentSetupMode.Guided, guidedReasonKey: "sshAgentSetupGuidedReasonMas" };
    case SshAgentSetupPackaging.Snap:
      return { mode: SshAgentSetupMode.Guided, guidedReasonKey: "sshAgentSetupGuidedReasonSnap" };
    case SshAgentSetupPackaging.Flatpak:
      return {
        mode: SshAgentSetupMode.Guided,
        guidedReasonKey: "sshAgentSetupGuidedReasonFlatpak",
      };
    case SshAgentSetupPackaging.WindowsStore:
      return {
        mode: SshAgentSetupMode.Guided,
        guidedReasonKey: "sshAgentSetupGuidedReasonWindowsStore",
      };
  }
  if (platform === SshAgentSetupPlatform.Windows) {
    return { mode: SshAgentSetupMode.Guided, guidedReasonKey: "sshAgentSetupGuidedReasonWindows" };
  }
  if (platform == null) {
    return {
      mode: SshAgentSetupMode.Guided,
      guidedReasonKey: "sshAgentSetupGuidedReasonUnsupportedPlatform",
    };
  }
  return { mode: SshAgentSetupMode.Automatic };
}

/** Uses the passwd entry's shell first, then $SHELL. Unknown shells get no profile step. */
export function detectLoginShell(
  passwdShell: string | null | undefined,
  envShell: string | undefined,
): SshSetupShell | null {
  const candidate = passwdShell != null && passwdShell !== "" ? passwdShell : envShell;
  if (candidate == null || candidate === "") {
    return null;
  }
  switch (path.basename(candidate)) {
    case "zsh":
      return SshSetupShell.Zsh;
    case "bash":
      return SshSetupShell.Bash;
    case "fish":
      return SshSetupShell.Fish;
    default:
      return null;
  }
}

/** macOS launchd always sets SSH_AUTH_SOCK to its own listener; that is not a user choice. */
export function isSystemDefaultAuthSock(value: string): boolean {
  return /^\/private\/tmp\/com\.apple\.launchd\.[^/]+\/Listeners$/.test(value);
}

interface KnownAgent {
  displayName: string;
  paths: (ctx: { home: string; runtimeDir: string | null; hostname: string }) => string[];
}

const KNOWN_AGENTS: readonly KnownAgent[] = Object.freeze([
  {
    displayName: "1Password",
    paths: ({ home }) => [
      path.join(home, "Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"),
      path.join(home, ".1password/agent.sock"),
    ],
  },
  {
    displayName: "GnuPG agent",
    paths: ({ home, runtimeDir }) => [
      path.join(home, ".gnupg/S.gpg-agent.ssh"),
      ...(runtimeDir != null ? [path.join(runtimeDir, "gnupg/S.gpg-agent.ssh")] : []),
    ],
  },
  {
    displayName: "GNOME Keyring",
    paths: ({ runtimeDir }) =>
      runtimeDir != null
        ? [path.join(runtimeDir, "keyring/ssh"), path.join(runtimeDir, "gcr/ssh")]
        : [],
  },
  {
    displayName: "Secretive",
    paths: ({ home }) => [
      path.join(home, "Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh"),
    ],
  },
  {
    displayName: "keychain",
    paths: ({ home, hostname }) => [path.join(home, ".keychain", `${hostname}-sh`)],
  },
]);

async function exists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

/** Detects other agents by the presence of well-known socket paths only. Never modifies them. */
export async function detectOtherAgents(ctx: {
  home: string;
  runtimeDir: string | null;
  hostname: string;
}): Promise<string[]> {
  const found: string[] = [];
  for (const agent of KNOWN_AGENTS) {
    for (const p of agent.paths(ctx)) {
      if (await exists(p)) {
        found.push(agent.displayName);
        break;
      }
    }
  }
  return found;
}
