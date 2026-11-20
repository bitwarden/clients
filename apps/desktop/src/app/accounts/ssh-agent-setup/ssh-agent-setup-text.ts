import {
  SshAgentSetupApplyResult,
  SshAgentSetupEnvironment,
  SshAgentVerifyOutcome,
  SshAgentVerifyResult,
} from "../../../autofill/models/ssh-agent-setup";

/**
 * Maps the error classes, reason identifiers and check outcomes sent by the main process to the
 * renderer's own i18n keys. Functions here return keys and positional placeholder values only,
 * never English, so the view translates them. Only identifiers in the maps are translated, so an
 * unknown identifier falls back to generic copy instead of showing a raw key to the user.
 */

export const SSH_AGENT_HELP_URL = "https://bitwarden.com/help/ssh-agent/";

export type SshAgentApplyErrorCode = NonNullable<SshAgentSetupApplyResult["errorCode"]>;
export type SshAgentStartErrorCode = NonNullable<SshAgentSetupEnvironment["startErrorCode"]>;

export type SshAgentSeverity = "danger" | "warning" | "info" | "success";

/** A "Technical details" line: an i18n key and its positional values ($1, $2, ...). */
export interface SshAgentDetailLine {
  key: string;
  placeholders: string[];
}

const GUIDED_REASON_KEYS: Readonly<Record<string, string>> = Object.freeze({
  sshAgentSetupGuidedReasonWindows: "sshAgentSetupGuidedReasonWindowsVfo1",
  sshAgentSetupGuidedReasonMas: "sshAgentSetupGuidedReasonMacAppStoreVfo1",
  sshAgentSetupGuidedReasonSnap: "sshAgentSetupGuidedReasonSnapVfo1",
  sshAgentSetupGuidedReasonFlatpak: "sshAgentSetupGuidedReasonFlatpakVfo1",
  sshAgentSetupGuidedReasonWindowsStore: "sshAgentSetupGuidedReasonWindowsStoreVfo1",
  sshAgentSetupGuidedReasonUnsupportedPlatform: "sshAgentSetupGuidedReasonUnsupportedPlatformVfo7",
});

const GUIDED_COMMAND_KEYS: Readonly<Record<string, string>> = Object.freeze({
  sshAgentSetupGuidedCommandWindowsDisableOpenSshAgent: "sshAgentSetupGuidedCmdWindowsServiceVfo1",
  sshAgentSetupGuidedCommandPosixExport: "sshAgentSetupGuidedCmdShellProfileVfo1",
  sshAgentSetupGuidedCommandFishExport: "sshAgentSetupGuidedCmdFishVfo1",
});

const BLOCKED_REASON_KEYS: Readonly<Record<string, string>> = Object.freeze({
  sshAgentSetupBlockedSymlink: "sshAgentSetupBlockedSymlinkVfo7",
  sshAgentSetupBlockedOwner: "sshAgentSetupBlockedOwnerVfo7",
  sshAgentSetupBlockedPermissions: "sshAgentSetupBlockedPermissionsVfo7",
  sshAgentSetupBlockedNotRegularFile: "sshAgentSetupBlockedNotRegularFileVfo7",
  sshAgentSetupBlockedOutsideHome: "sshAgentSetupBlockedOutsideHomeVfo7",
  sshAgentSetupBlockedFileTooLarge: "sshAgentSetupBlockedTooLargeVfo7",
  sshAgentSetupBlockedUnreadable: "sshAgentSetupBlockedUnreadableVfo7",
  sshAgentSetupBlockedUnsafeSocketPath: "sshAgentSetupBlockedUnsafeAgentAddressVfo7",
  sshAgentSetupBlockedNoSocketAddress: "sshAgentSetupBlockedNoAgentAddressVfo7",
  sshAgentSetupBlockedManagedBlockModified: "sshAgentSetupBlockedEditedVfo7",
});

function lookup(map: Readonly<Record<string, string>>, id: string | undefined): string | null {
  return id != null && Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null;
}

export function guidedReasonKey(id: string | undefined): string {
  return lookup(GUIDED_REASON_KEYS, id) ?? "sshAgentSetupGuidedReasonGenericVfo1";
}

export function guidedCommandKey(id: string): string {
  return lookup(GUIDED_COMMAND_KEYS, id) ?? "sshAgentSetupGuidedCmdGenericVfo1";
}

/** Returns the specific reason, or null when only the generic "blocked" text should show. */
export function blockedReasonKey(id: string | undefined): string | null {
  return lookup(BLOCKED_REASON_KEYS, id);
}

export interface SshAgentProblemView {
  severity: SshAgentSeverity;
  titleKey: string;
  descKey: string;
  details?: SshAgentDetailLine;
  /** "try-again" retries the agent check. "close" is the only way out when the user must act elsewhere. */
  primaryAction: "try-again" | "close";
  canRetry: boolean;
}

function agentOffView(): SshAgentProblemView {
  return {
    severity: "info",
    titleKey: "sshAgentSetupAgentOffTitleVfo7",
    descKey: "sshAgentSetupAgentOffDescVfo7",
    primaryAction: "close",
    canRetry: false,
  };
}

/**
 * Describes why the agent is not available, or returns null when it is running. A switched-off
 * agent is not a start failure: it gets an info view that only offers Close.
 */
export function toAgentProblemView(env: SshAgentSetupEnvironment): SshAgentProblemView | null {
  if (env.agentRunning) {
    return null;
  }
  if (!env.agentEnabled) {
    return agentOffView();
  }

  const address = env.intendedSocketAddress ?? env.socketAddress;
  const base = {
    severity: "danger",
    titleKey: "sshAgentSetupAgentCantStartTitleVfo7",
    primaryAction: "try-again",
    canRetry: true,
  } as const;

  switch (env.startErrorCode) {
    case "address-in-use":
      return {
        ...base,
        descKey: "sshAgentSetupAgentAddressInUseVfo7",
        details:
          address != null
            ? { key: "sshAgentSetupAgentAddressInUseDetailVfo7", placeholders: [address] }
            : undefined,
      };
    case "permission-denied":
      return {
        ...base,
        descKey: "sshAgentSetupAgentPermissionDeniedVfo7",
        details:
          address != null
            ? { key: "sshAgentSetupAgentPermissionDeniedDetailVfo7", placeholders: [address] }
            : undefined,
      };
    default:
      return {
        ...base,
        descKey: "sshAgentSetupAgentStartUnknownVfo7",
        details: { key: "sshAgentSetupAgentUnknownDetailVfo7", placeholders: [] },
      };
  }
}

export interface SshAgentVerifyView {
  /** True when nothing needs the user's attention. */
  success: boolean;
  severity: SshAgentSeverity;
  titleKey: string;
  descKey: string;
  /** "Technical details" lines. Empty when there is nothing useful to show. */
  detailsLines: SshAgentDetailLine[];
  /** "check-again" re-runs the check, "change-setup" returns to the choose view, "none" is Close only. */
  action: "check-again" | "change-setup" | "none";
  /** Reminder that terminals opened before the change keep the old setting. */
  openTerminalHint: boolean;
  /** Success only: new terminals could not be checked on this device. */
  shellNotChecked: boolean;
}

function failureView(
  severity: SshAgentSeverity,
  titleKey: string,
  descKey: string,
  action: SshAgentVerifyView["action"],
  detailsLines: SshAgentDetailLine[] = [],
): SshAgentVerifyView {
  return {
    success: false,
    severity,
    titleKey,
    descKey,
    detailsLines,
    action,
    openTerminalHint: false,
    shellNotChecked: false,
  };
}

const NOT_CONNECTED_TITLE = "sshAgentSetupVerifyNotConnectedTitleVfo7";
const NOT_CONNECTED_DESC = "sshAgentSetupVerifyNotConnectedDescVfo7";
const CHECK_FAILED_TITLE = "sshAgentSetupVerifyCheckFailedTitleVfo7";
const CHECK_FAILED_DESC = "sshAgentSetupVerifyCheckFailedDescVfo7";

/** The view for when the check itself could not run, for example when the verify call threw. */
export function toVerifyFailedView(): SshAgentVerifyView {
  return failureView("warning", CHECK_FAILED_TITLE, CHECK_FAILED_DESC, "check-again");
}

/**
 * Reduces the three independent checks to one result. Only the first problem is reported, in the
 * order: agent, ssh, new terminals. A check that did not run counts as fine, except that a
 * switched-off agent is reported as such. "Not configured" is info, not an error, and never
 * tells the user to restart the agent.
 */
export function toVerifyView(
  result: SshAgentVerifyResult,
  env: SshAgentSetupEnvironment,
): SshAgentVerifyView {
  const { Unreachable, OtherAgent, NotConfigured, NotChecked } = SshAgentVerifyOutcome;
  const details = result.details;

  if (result.agent === NotChecked && !env.agentEnabled) {
    const off = agentOffView();
    return failureView(off.severity, off.titleKey, off.descKey, "none");
  }

  if (result.agent === Unreachable) {
    const address = details?.socketAddress ?? env.socketAddress ?? env.intendedSocketAddress;
    return failureView(
      "danger",
      "sshAgentSetupVerifyNoResponseTitleVfo7",
      "sshAgentSetupVerifyNoResponseDescVfo7",
      "check-again",
      address != null
        ? [{ key: "sshAgentSetupVerifyNoResponseDetailVfo7", placeholders: [address] }]
        : [],
    );
  }

  if (result.sshClient === OtherAgent) {
    return failureView(
      "warning",
      "sshAgentSetupVerifySshOtherAgentTitleVfo7",
      "sshAgentSetupVerifySshOtherAgentDescVfo7",
      "change-setup",
      details?.identityAgent != null
        ? [
            {
              key: "sshAgentSetupVerifySshOtherAgentDetailVfo7",
              placeholders: [details.identityAgent],
            },
          ]
        : [],
    );
  }
  if (result.sshClient === Unreachable) {
    return failureView("warning", CHECK_FAILED_TITLE, CHECK_FAILED_DESC, "check-again");
  }
  if (result.sshClient === NotConfigured) {
    return failureView("info", NOT_CONNECTED_TITLE, NOT_CONNECTED_DESC, "change-setup");
  }

  if (result.shell === OtherAgent) {
    return failureView(
      "warning",
      "sshAgentSetupVerifyShellOtherAgentTitleVfo7",
      "sshAgentSetupVerifyShellOtherAgentDescVfo7",
      "check-again",
      details?.overrideFile != null && details.overrideLine != null
        ? [
            {
              key: "sshAgentSetupVerifyShellOtherAgentDetailVfo7",
              placeholders: [details.overrideFile, String(details.overrideLine)],
            },
          ]
        : [],
    );
  }
  if (result.shell === Unreachable) {
    return failureView("warning", CHECK_FAILED_TITLE, CHECK_FAILED_DESC, "check-again");
  }
  if (result.shell === NotConfigured) {
    return failureView("info", NOT_CONNECTED_TITLE, NOT_CONNECTED_DESC, "change-setup");
  }

  return {
    success: true,
    severity: "success",
    titleKey: "sshAgentSetupVerifyAllSetTitleVfo7",
    descKey: "sshAgentSetupVerifyAllSetDescVfo7",
    detailsLines: [],
    action: "none",
    openTerminalHint: true,
    shellNotChecked: result.shell === NotChecked,
  };
}

export interface SshAgentApplyErrorView {
  severity: SshAgentSeverity;
  titleKey: string;
  descKey: string;
  /** Positional values ($1) for the title and description. Empty when the path is unknown. */
  placeholders: string[];
  details?: SshAgentDetailLine;
}

/** Describes one failed apply result. The caller shows it inline next to the file. */
export function applyErrorView(result: SshAgentSetupApplyResult): SshAgentApplyErrorView {
  const path = result.displayPath != null ? [result.displayPath] : [];

  switch (result.errorCode) {
    case "changed-since-preview":
      return {
        severity: "info",
        titleKey: "sshAgentSetupFileChangedTitleVfo7",
        descKey: "sshAgentSetupFileChangedDescVfo7",
        placeholders: path,
      };
    case "write-failed":
      return {
        severity: "danger",
        titleKey: "sshAgentSetupWriteFailedTitleVfo7",
        descKey: "sshAgentSetupWriteFailedDescVfo7",
        placeholders: path,
        details: {
          key: "sshAgentSetupWriteFailedDetailVfo7",
          placeholders: [result.writeErrorClass ?? "other"],
        },
      };
    case "blocked":
      return {
        severity: "warning",
        titleKey: "sshAgentSetupBlockedTitleVfo7",
        descKey: blockedReasonKey(result.blockedReasonKey) ?? "sshAgentSetupBlockedGenericVfo7",
        placeholders: path,
      };
    default:
      return {
        severity: "danger",
        titleKey: "sshAgentSetupIncompleteTitleVfo7",
        descKey: "sshAgentSetupIncompleteDescVfo7",
        placeholders: [],
      };
  }
}
