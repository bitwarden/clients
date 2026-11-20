import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  CalloutModule,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  SshAgentSetupApplyResult,
  SshAgentSetupStep,
  SshAgentSetupStepKind,
  SshAgentSetupStepStatus,
} from "../../../autofill/models/ssh-agent-setup";

import {
  SshAgentSetupDetailsComponent,
  SshAgentSetupPathComponent,
} from "./ssh-agent-setup-details.component";
import { applyErrorView } from "./ssh-agent-setup-text";

/** Steps the user can opt in or out of. Blocked and already configured steps cannot change. */
export function isToggleableStep(step: SshAgentSetupStep): boolean {
  return (
    step.status === SshAgentSetupStepStatus.Pending ||
    step.status === SshAgentSetupStepStatus.Conflict ||
    step.status === SshAgentSetupStepStatus.Failed
  );
}

/** Another agent's setting is in the way, so the user decides whether to replace it. */
export function isConflictStep(step: SshAgentSetupStep): boolean {
  return (
    step.status === SshAgentSetupStepStatus.Conflict ||
    (step.status === SshAgentSetupStepStatus.Failed && step.conflict != null)
  );
}

/** Conflicts follow the user's choice, so another agent's setup is never changed without consent. */
export function isSelectedByDefault(step: SshAgentSetupStep): boolean {
  return (
    step.status === SshAgentSetupStepStatus.Pending ||
    step.status === SshAgentSetupStepStatus.Failed
  );
}

const CHANGE_KEYS = {
  add: {
    [SshAgentSetupStepKind.SshConfigInclude]: "sshAgentSetupChangeAddSshConfigVfo7",
    [SshAgentSetupStepKind.ShellProfile]: "sshAgentSetupChangeAddShellVfo7",
  },
  replace: {
    [SshAgentSetupStepKind.SshConfigInclude]: "sshAgentSetupChangeReplaceSshConfigVfo7",
    [SshAgentSetupStepKind.ShellProfile]: "sshAgentSetupChangeReplaceShellVfo7",
  },
} as const;

/**
 * What setup will do, one plain line per file, with the exact lines behind a disclosure. The
 * footer buttons in the dialog are the actions, so the apply contract (plan id and step ids) is
 * unchanged. Files Bitwarden will not change and files that failed to save get an inline callout.
 */
@Component({
  selector: "app-ssh-agent-setup-preview",
  templateUrl: "ssh-agent-setup-preview.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalloutModule,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    I18nPipe,
    LinkModule,
    SshAgentSetupDetailsComponent,
    SshAgentSetupPathComponent,
    TypographyModule,
  ],
})
export class SshAgentSetupPreviewComponent {
  readonly steps = input.required<SshAgentSetupStep[]>();
  /** Ids of the steps the primary button will apply. Unselected conflicts are left as they are. */
  readonly selectedStepIds = input<string[]>([]);
  /** Failed apply results by step id. */
  readonly results = input<Record<string, SshAgentSetupApplyResult>>({});

  protected readonly view = computed(() => {
    const results = this.results();
    const selected = new Set(this.selectedStepIds());
    const rows = this.steps().map((step) => {
      const unchanged =
        step.status === SshAgentSetupStepStatus.AlreadyConfigured ||
        step.status === SshAgentSetupStepStatus.Applied;
      const isBlocked = step.status === SshAgentSetupStepStatus.Blocked;
      const isConflict = !unchanged && !isBlocked && step.conflict != null;
      const included = !isConflict || selected.has(step.id);

      let changeKey: string | null = null;
      if (unchanged) {
        changeKey = "sshAgentSetupChangeAlreadySetUpVfo7";
      } else if (!isBlocked) {
        changeKey = !included
          ? "sshAgentSetupChangeLeaveVfo7"
          : CHANGE_KEYS[isConflict ? "replace" : "add"][step.kind];
      }

      const result = results[step.id];
      const problem = result
        ? applyErrorView(result)
        : isBlocked
          ? applyErrorView({
              stepId: step.id,
              status: step.status,
              errorCode: "blocked",
              displayPath: step.displayPath,
              blockedReasonKey: step.blockedReasonKey,
            })
          : null;

      return {
        step,
        changeKey,
        problem,
        isBlocked,
        showDiff: step.addedLines.length > 0 && !unchanged && !isBlocked && included,
        showConflictLine: isConflict && included && step.conflict != null,
        existingLineKey:
          step.conflict == null
            ? null
            : step.conflict.lineNumber >= 1
              ? "sshAgentSetupCurrentSettingLineVfo1"
              : "sshAgentSetupCurrentSettingVfo1",
      };
    });
    return {
      rows,
      hasDetails: rows.some((row) => row.showDiff || row.showConflictLine),
    };
  });
}
