import { readFileSync } from "fs";
import { join } from "path";

import {
  SshAgentSetupApplyResult,
  SshAgentSetupEnvironment,
  SshAgentSetupMode,
  SshAgentSetupPackaging,
  SshAgentSetupPlatform,
  SshAgentSetupStepStatus,
  SshAgentVerifyOutcome,
  SshAgentVerifyResult,
} from "../../../autofill/models/ssh-agent-setup";

import {
  applyErrorView,
  blockedReasonKey,
  guidedCommandKey,
  guidedReasonKey,
  toAgentProblemView,
  toVerifyFailedView,
  toVerifyView,
} from "./ssh-agent-setup-text";

const ADDRESS = "~/.bitwarden-ssh-agent.sock";

function environment(overrides: Partial<SshAgentSetupEnvironment> = {}): SshAgentSetupEnvironment {
  return {
    platform: SshAgentSetupPlatform.Mac,
    packaging: SshAgentSetupPackaging.Standard,
    mode: SshAgentSetupMode.Automatic,
    socketAddress: ADDRESS,
    intendedSocketAddress: ADDRESS,
    agentEnabled: true,
    agentRunning: true,
    otherAgents: [],
    ...overrides,
  };
}

describe("ssh-agent-setup-text", () => {
  describe("toAgentProblemView", () => {
    it("returns null when the agent is running", () => {
      expect(toAgentProblemView(environment())).toBeNull();
    });

    it("reports an address in use as a danger the user can retry, with the address", () => {
      const view = toAgentProblemView(
        environment({ agentRunning: false, socketAddress: null, startErrorCode: "address-in-use" }),
      );

      expect(view).toEqual({
        severity: "danger",
        titleKey: "sshAgentSetupAgentCantStartTitleVfo7",
        descKey: "sshAgentSetupAgentAddressInUseVfo7",
        details: { key: "sshAgentSetupAgentAddressInUseDetailVfo7", placeholders: [ADDRESS] },
        primaryAction: "try-again",
        canRetry: true,
      });
    });

    it("reports permission denied with the address", () => {
      const view = toAgentProblemView(
        environment({ agentRunning: false, startErrorCode: "permission-denied" }),
      );

      expect(view?.severity).toBe("danger");
      expect(view?.descKey).toBe("sshAgentSetupAgentPermissionDeniedVfo7");
      expect(view?.details).toEqual({
        key: "sshAgentSetupAgentPermissionDeniedDetailVfo7",
        placeholders: [ADDRESS],
      });
      expect(view?.canRetry).toBe(true);
    });

    it("omits address details when no address is known", () => {
      const view = toAgentProblemView(
        environment({
          agentRunning: false,
          socketAddress: null,
          intendedSocketAddress: null,
          startErrorCode: "address-in-use",
        }),
      );

      expect(view?.details).toBeUndefined();
    });

    it.each([undefined, "unknown" as const])(
      "reports an unknown start failure (%s) with the error line",
      (startErrorCode) => {
        const view = toAgentProblemView(environment({ agentRunning: false, startErrorCode }));

        expect(view).toMatchObject({
          severity: "danger",
          titleKey: "sshAgentSetupAgentCantStartTitleVfo7",
          descKey: "sshAgentSetupAgentStartUnknownVfo7",
          details: { key: "sshAgentSetupAgentUnknownDetailVfo7", placeholders: [] },
          primaryAction: "try-again",
          canRetry: true,
        });
      },
    );

    it("treats a switched-off agent as info that only offers Close, not a start failure", () => {
      const view = toAgentProblemView(
        environment({
          agentRunning: false,
          agentEnabled: false,
          socketAddress: null,
          startErrorCode: "address-in-use",
        }),
      );

      expect(view).toEqual({
        severity: "info",
        titleKey: "sshAgentSetupAgentOffTitleVfo7",
        descKey: "sshAgentSetupAgentOffDescVfo7",
        primaryAction: "close",
        canRetry: false,
      });
    });
  });

  describe("toVerifyView", () => {
    const { Ok, Unreachable, OtherAgent, NotConfigured, NotChecked, NoKeys } =
      SshAgentVerifyOutcome;
    const view = (
      agent: SshAgentVerifyOutcome,
      sshClient: SshAgentVerifyOutcome,
      shell: SshAgentVerifyOutcome,
      details?: SshAgentVerifyResult["details"],
      env = environment(),
    ) => toVerifyView({ agent, sshClient, shell, details }, env);

    it("succeeds when every check is fine and reminds about open terminals", () => {
      expect(view(Ok, Ok, Ok)).toEqual({
        success: true,
        severity: "success",
        titleKey: "sshAgentSetupVerifyAllSetTitleVfo7",
        descKey: "sshAgentSetupVerifyAllSetDescVfo7",
        detailsLines: [],
        action: "none",
        openTerminalHint: true,
        shellNotChecked: false,
      });
    });

    it("succeeds and notes when new terminals were not checked", () => {
      const result = view(Ok, NotChecked, NotChecked);

      expect(result.success).toBe(true);
      expect(result.shellNotChecked).toBe(true);
      expect(result.openTerminalHint).toBe(true);
    });

    it("does not set the not-checked note when only ssh was not checked", () => {
      expect(view(Ok, NotChecked, Ok).shellNotChecked).toBe(false);
    });

    it("does not treat no keys as a failure", () => {
      expect(view(NoKeys, Ok, Ok).success).toBe(true);
    });

    describe("agent", () => {
      it("reports an unresponsive agent as danger with the address and a check again action", () => {
        const result = view(Unreachable, Ok, Ok, { socketAddress: "pipe-from-main" });

        expect(result).toMatchObject({
          success: false,
          severity: "danger",
          titleKey: "sshAgentSetupVerifyNoResponseTitleVfo7",
          descKey: "sshAgentSetupVerifyNoResponseDescVfo7",
          action: "check-again",
          openTerminalHint: false,
          detailsLines: [
            { key: "sshAgentSetupVerifyNoResponseDetailVfo7", placeholders: ["pipe-from-main"] },
          ],
        });
      });

      it("falls back to the environment address when the result has none", () => {
        expect(view(Unreachable, Ok, Ok).detailsLines).toEqual([
          { key: "sshAgentSetupVerifyNoResponseDetailVfo7", placeholders: [ADDRESS] },
        ]);
      });

      it("omits details when no address is known anywhere", () => {
        const env = environment({ socketAddress: null, intendedSocketAddress: null });

        expect(view(Unreachable, Ok, Ok, undefined, env).detailsLines).toEqual([]);
      });

      it("reports a switched-off agent as info with no retry, not as a failure to start", () => {
        const env = environment({ agentEnabled: false, agentRunning: false });
        const result = view(NotChecked, Ok, Ok, undefined, env);

        expect(result).toMatchObject({
          success: false,
          severity: "info",
          titleKey: "sshAgentSetupAgentOffTitleVfo7",
          descKey: "sshAgentSetupAgentOffDescVfo7",
          action: "none",
        });
      });

      it("counts an unchecked agent as fine while the agent is enabled", () => {
        expect(view(NotChecked, Ok, Ok).success).toBe(true);
      });
    });

    describe("ssh", () => {
      it("reports another agent as a warning that offers Change setup, with the IdentityAgent", () => {
        const result = view(Ok, OtherAgent, Ok, { identityAgent: "~/other.sock" });

        expect(result).toMatchObject({
          success: false,
          severity: "warning",
          titleKey: "sshAgentSetupVerifySshOtherAgentTitleVfo7",
          descKey: "sshAgentSetupVerifySshOtherAgentDescVfo7",
          action: "change-setup",
          openTerminalHint: false,
          detailsLines: [
            { key: "sshAgentSetupVerifySshOtherAgentDetailVfo7", placeholders: ["~/other.sock"] },
          ],
        });
      });

      it("omits details when the IdentityAgent value is unknown", () => {
        expect(view(Ok, OtherAgent, Ok).detailsLines).toEqual([]);
      });

      it("reports not configured as info that offers Change setup", () => {
        expect(view(Ok, NotConfigured, Ok)).toMatchObject({
          success: false,
          severity: "info",
          titleKey: "sshAgentSetupVerifyNotConnectedTitleVfo7",
          descKey: "sshAgentSetupVerifyNotConnectedDescVfo7",
          action: "change-setup",
        });
      });

      it("reports a check that could not run as a warning the user can retry", () => {
        expect(view(Ok, Unreachable, Ok)).toMatchObject({
          severity: "warning",
          titleKey: "sshAgentSetupVerifyCheckFailedTitleVfo7",
          descKey: "sshAgentSetupVerifyCheckFailedDescVfo7",
          action: "check-again",
        });
      });
    });

    describe("new terminals", () => {
      it("reports another agent as a warning with the file and line", () => {
        const result = view(Ok, Ok, OtherAgent, { overrideFile: "~/.zshrc", overrideLine: 14 });

        expect(result).toMatchObject({
          success: false,
          severity: "warning",
          titleKey: "sshAgentSetupVerifyShellOtherAgentTitleVfo7",
          descKey: "sshAgentSetupVerifyShellOtherAgentDescVfo7",
          action: "check-again",
          detailsLines: [
            {
              key: "sshAgentSetupVerifyShellOtherAgentDetailVfo7",
              placeholders: ["~/.zshrc", "14"],
            },
          ],
        });
      });

      it("omits details unless both the file and the line are known", () => {
        expect(view(Ok, Ok, OtherAgent, { overrideFile: "~/.zshrc" }).detailsLines).toEqual([]);
        expect(view(Ok, Ok, OtherAgent, { overrideLine: 3 }).detailsLines).toEqual([]);
      });

      it("reports not configured as info, offers Change setup and does not blame the agent", () => {
        const result = view(Ok, Ok, NotConfigured);

        expect(result).toMatchObject({
          success: false,
          severity: "info",
          titleKey: "sshAgentSetupVerifyNotConnectedTitleVfo7",
          descKey: "sshAgentSetupVerifyNotConnectedDescVfo7",
          action: "change-setup",
          openTerminalHint: false,
        });
        expect(result.titleKey).not.toBe("sshAgentSetupVerifyNoResponseTitleVfo7");
        expect(result.descKey).not.toBe("sshAgentSetupVerifyNoResponseDescVfo7");
        expect(result.detailsLines).toEqual([]);
      });

      it("reports a check that could not run as a warning the user can retry", () => {
        expect(view(Ok, Ok, Unreachable)).toMatchObject({
          severity: "warning",
          titleKey: "sshAgentSetupVerifyCheckFailedTitleVfo7",
          action: "check-again",
        });
      });
    });

    it("reports only the first problem, in the order agent, ssh, new terminals", () => {
      expect(view(Unreachable, OtherAgent, OtherAgent).titleKey).toBe(
        "sshAgentSetupVerifyNoResponseTitleVfo7",
      );
      expect(view(Ok, OtherAgent, NotConfigured).titleKey).toBe(
        "sshAgentSetupVerifySshOtherAgentTitleVfo7",
      );
      expect(view(Ok, NotConfigured, OtherAgent).titleKey).toBe(
        "sshAgentSetupVerifyNotConnectedTitleVfo7",
      );
    });

    it("never reports success for a failure", () => {
      const failures: [SshAgentVerifyOutcome, SshAgentVerifyOutcome, SshAgentVerifyOutcome][] = [
        [Unreachable, Ok, Ok],
        [Ok, OtherAgent, Ok],
        [Ok, NotConfigured, Ok],
        [Ok, Ok, OtherAgent],
        [Ok, Ok, NotConfigured],
      ];

      for (const [agent, sshClient, shell] of failures) {
        const result = view(agent, sshClient, shell);
        expect(result.success).toBe(false);
        expect(result.severity).not.toBe("success");
      }
    });
  });

  describe("toVerifyFailedView", () => {
    it("is a warning that offers Check again", () => {
      expect(toVerifyFailedView()).toMatchObject({
        success: false,
        severity: "warning",
        titleKey: "sshAgentSetupVerifyCheckFailedTitleVfo7",
        descKey: "sshAgentSetupVerifyCheckFailedDescVfo7",
        action: "check-again",
        detailsLines: [],
      });
    });
  });

  describe("applyErrorView", () => {
    const failed = (
      overrides: Partial<SshAgentSetupApplyResult> = {},
    ): SshAgentSetupApplyResult => ({
      stepId: "ssh-config",
      status: SshAgentSetupStepStatus.Failed,
      displayPath: "~/.ssh/config",
      ...overrides,
    });

    it("reports a file that changed as info with the path", () => {
      expect(applyErrorView(failed({ errorCode: "changed-since-preview" }))).toEqual({
        severity: "info",
        titleKey: "sshAgentSetupFileChangedTitleVfo7",
        descKey: "sshAgentSetupFileChangedDescVfo7",
        placeholders: ["~/.ssh/config"],
      });
    });

    it("reports a write failure as danger with the path and the error class", () => {
      expect(
        applyErrorView(failed({ errorCode: "write-failed", writeErrorClass: "read-only" })),
      ).toEqual({
        severity: "danger",
        titleKey: "sshAgentSetupWriteFailedTitleVfo7",
        descKey: "sshAgentSetupWriteFailedDescVfo7",
        placeholders: ["~/.ssh/config"],
        details: { key: "sshAgentSetupWriteFailedDetailVfo7", placeholders: ["read-only"] },
      });
    });

    it("uses the other class when a write failure has none", () => {
      expect(applyErrorView(failed({ errorCode: "write-failed" })).details?.placeholders).toEqual([
        "other",
      ]);
    });

    it("reports a blocked file as a warning with its specific reason", () => {
      expect(
        applyErrorView(
          failed({ errorCode: "blocked", blockedReasonKey: "sshAgentSetupBlockedSymlink" }),
        ),
      ).toEqual({
        severity: "warning",
        titleKey: "sshAgentSetupBlockedTitleVfo7",
        descKey: "sshAgentSetupBlockedSymlinkVfo7",
        placeholders: ["~/.ssh/config"],
      });
    });

    it("falls back to a generic blocked reason for an unknown identifier", () => {
      expect(
        applyErrorView(failed({ errorCode: "blocked", blockedReasonKey: "somethingElse" })).descKey,
      ).toBe("sshAgentSetupBlockedGenericVfo7");
      expect(applyErrorView(failed({ errorCode: "blocked" })).descKey).toBe(
        "sshAgentSetupBlockedGenericVfo7",
      );
    });

    it.each(["plan-expired" as const, "unknown" as const, undefined])(
      "reports %s as a setup that didn't finish",
      (errorCode) => {
        expect(applyErrorView(failed({ errorCode }))).toEqual({
          severity: "danger",
          titleKey: "sshAgentSetupIncompleteTitleVfo7",
          descKey: "sshAgentSetupIncompleteDescVfo7",
          placeholders: [],
        });
      },
    );

    it("passes no placeholders when the path is unknown", () => {
      expect(
        applyErrorView(failed({ errorCode: "write-failed", displayPath: undefined })).placeholders,
      ).toEqual([]);
    });
  });

  it("maps main process identifiers to renderer keys and falls back for unknown ones", () => {
    expect(guidedReasonKey("sshAgentSetupGuidedReasonMas")).toBe(
      "sshAgentSetupGuidedReasonMacAppStoreVfo1",
    );
    expect(guidedReasonKey("sshAgentSetupGuidedReasonUnsupportedPlatform")).toBe(
      "sshAgentSetupGuidedReasonUnsupportedPlatformVfo7",
    );
    expect(guidedReasonKey("somethingElse")).toBe("sshAgentSetupGuidedReasonGenericVfo1");
    expect(guidedReasonKey(undefined)).toBe("sshAgentSetupGuidedReasonGenericVfo1");
    expect(guidedCommandKey("sshAgentSetupGuidedCommandWindowsDisableOpenSshAgent")).toBe(
      "sshAgentSetupGuidedCmdWindowsServiceVfo1",
    );
    expect(guidedCommandKey("sshAgentSetupGuidedCommandFishExport")).toBe(
      "sshAgentSetupGuidedCmdFishVfo1",
    );
    expect(guidedCommandKey("toString")).toBe("sshAgentSetupGuidedCmdGenericVfo1");
    expect(blockedReasonKey("sshAgentSetupBlockedManagedBlockModified")).toBe(
      "sshAgentSetupBlockedEditedVfo7",
    );
    expect(blockedReasonKey("sshAgentSetupBlockedNoSocketAddress")).toBe(
      "sshAgentSetupBlockedNoAgentAddressVfo7",
    );
    expect(blockedReasonKey("somethingElse")).toBeNull();
    expect(blockedReasonKey(undefined)).toBeNull();
  });

  it("only returns keys that exist in the English messages", () => {
    const messages = JSON.parse(
      readFileSync(join(__dirname, "../../../locales/en/messages.json"), "utf8"),
    ) as Record<string, unknown>;
    const keys = new Set<string>();
    const collect = (...ks: (string | undefined)[]) => ks.forEach((k) => k && keys.add(k));
    const outcomes = Object.values(SshAgentVerifyOutcome);

    for (const code of [undefined, "address-in-use", "permission-denied", "unknown"] as const) {
      const p = toAgentProblemView(environment({ agentRunning: false, startErrorCode: code }));
      collect(p?.titleKey, p?.descKey, p?.details?.key);
    }
    const off = toAgentProblemView(environment({ agentRunning: false, agentEnabled: false }));
    collect(off?.titleKey, off?.descKey);
    for (const agent of outcomes) {
      for (const sshClient of outcomes) {
        for (const shell of outcomes) {
          for (const agentEnabled of [true, false]) {
            const v = toVerifyView(
              {
                agent,
                sshClient,
                shell,
                details: {
                  identityAgent: "x",
                  overrideFile: "~/.zshrc",
                  overrideLine: 1,
                  socketAddress: "s",
                },
              },
              environment({ agentEnabled }),
            );
            collect(v.titleKey, v.descKey, ...v.detailsLines.map((d) => d.key));
          }
        }
      }
    }
    const codes = ["changed-since-preview", "write-failed", "blocked", "plan-expired", "unknown"];
    for (const errorCode of codes as SshAgentSetupApplyResult["errorCode"][]) {
      const v = applyErrorView({ stepId: "a", status: SshAgentSetupStepStatus.Failed, errorCode });
      collect(v.titleKey, v.descKey, v.details?.key);
    }
    for (const id of [
      "sshAgentSetupBlockedSymlink",
      "sshAgentSetupBlockedOwner",
      "sshAgentSetupBlockedPermissions",
      "sshAgentSetupBlockedNotRegularFile",
      "sshAgentSetupBlockedOutsideHome",
      "sshAgentSetupBlockedFileTooLarge",
      "sshAgentSetupBlockedUnreadable",
      "sshAgentSetupBlockedUnsafeSocketPath",
      "sshAgentSetupBlockedNoSocketAddress",
      "sshAgentSetupBlockedManagedBlockModified",
    ]) {
      collect(blockedReasonKey(id) ?? undefined);
    }
    collect(guidedReasonKey("sshAgentSetupGuidedReasonUnsupportedPlatform"));
    collect(toVerifyFailedView().titleKey, toVerifyFailedView().descKey);

    expect(keys.size).toBeGreaterThan(20);
    for (const key of keys) {
      expect(messages[key]).toBeDefined();
    }
  });
});
