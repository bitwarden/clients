import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  DialogService,
  LinkModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  SshAgentSetupOverallStatus,
  SshAgentSetupStepStatus,
} from "../../../autofill/models/ssh-agent-setup";

import { SshAgentSetupAutoOfferService } from "./ssh-agent-setup-auto-offer.service";
import {
  SshAgentSetupDialogComponent,
  SshAgentSetupStartAt,
} from "./ssh-agent-setup-dialog.component";
import { SSH_AGENT_HELP_URL } from "./ssh-agent-setup-text";
import { SshAgentSetupClient } from "./ssh-agent-setup.client";

type SshAgentSetupRowState = "loading" | "error" | SshAgentSetupOverallStatus;

const ROW_VIEW: Record<
  SshAgentSetupRowState,
  { badgeKey: string; badgeVariant: BadgeVariant; descKey: string | null }
> = {
  loading: {
    badgeKey: "sshAgentSetupStatusCheckingVfo1",
    badgeVariant: "subtle",
    descKey: null,
  },
  error: {
    badgeKey: "sshAgentSetupStatusErrorVfo7",
    badgeVariant: "warning",
    descKey: "sshAgentSetupStatusErrorDescVfo7",
  },
  [SshAgentSetupOverallStatus.NotConfigured]: {
    badgeKey: "sshAgentSetupStatusNotSetUpVfo1",
    badgeVariant: "subtle",
    descKey: "sshAgentSetupStatusNotSetUpDescVfo1",
  },
  [SshAgentSetupOverallStatus.Configured]: {
    badgeKey: "sshAgentSetupStatusSetUpVfo1",
    badgeVariant: "success",
    descKey: "sshAgentSetupStatusSetUpDescVfo1",
  },
  [SshAgentSetupOverallStatus.Partial]: {
    badgeKey: "sshAgentSetupStatusPartialVfo1",
    badgeVariant: "warning",
    descKey: "sshAgentSetupStatusPartialDescVfo1",
  },
  [SshAgentSetupOverallStatus.Conflict]: {
    badgeKey: "sshAgentSetupStatusConflictVfo1",
    badgeVariant: "warning",
    descKey: "sshAgentSetupStatusConflictDescVfo1",
  },
  [SshAgentSetupOverallStatus.Unsupported]: {
    badgeKey: "sshAgentSetupStatusUnsupportedVfo1",
    badgeVariant: "subtle",
    descKey: "sshAgentSetupStatusUnsupportedDescVfo1",
  },
};

/**
 * The "SSH client setup" row in the SSH agent settings card. Shows whether this device is set up,
 * opens the setup flow, and removes the setup after the user confirms.
 *
 * Hidden (and skipped by the card's dividers) while the SSH agent is off.
 */
@Component({
  selector: "app-ssh-agent-setup-status",
  templateUrl: "ssh-agent-setup-status.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonModule, I18nPipe, LinkModule, TypographyModule],
  host: {
    class: "tw-block tw-p-4",
    "[attr.hidden]": "agentEnabled() ? null : ''",
  },
})
export class SshAgentSetupStatusComponent {
  readonly agentEnabled = input(false);

  private readonly client = inject(SshAgentSetupClient);
  private readonly dialogService = inject(DialogService);
  private readonly autoOffer = inject(SshAgentSetupAutoOfferService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly Status = SshAgentSetupOverallStatus;
  protected readonly StartAt = SshAgentSetupStartAt;

  protected readonly state = signal<SshAgentSetupRowState>("loading");
  protected readonly view = computed(() => ROW_VIEW[this.state()]);
  protected readonly removing = signal(false);

  constructor() {
    effect(() => {
      if (this.agentEnabled()) {
        untracked(() => {
          void this.refresh();
        });
      }
    });
  }

  /**
   * Call after the user turns the SSH agent switch on. Opens setup automatically at most once per
   * app session, and only when there is something to set up.
   */
  async offerSetupAfterEnable(enabled: boolean): Promise<void> {
    if (!enabled || this.autoOffer.alreadyOffered) {
      return;
    }
    let status: SshAgentSetupOverallStatus;
    try {
      status = await this.client.getStatus();
    } catch {
      return;
    }
    if (
      status === SshAgentSetupOverallStatus.Configured ||
      status === SshAgentSetupOverallStatus.Unsupported ||
      !this.autoOffer.claim()
    ) {
      return;
    }
    // Focus goes back to the switch the user just used, so don't move it afterwards.
    await this.openSetup(SshAgentSetupStartAt.Connect, false);
  }

  protected async refresh(): Promise<void> {
    try {
      this.state.set(await this.client.getStatus());
    } catch {
      this.state.set("error");
    }
  }

  protected async openSetup(startAt: SshAgentSetupStartAt, returnFocus = true): Promise<void> {
    const dialogRef = SshAgentSetupDialogComponent.open(this.dialogService, { startAt });
    await firstValueFrom(dialogRef.closed);
    await this.refresh();
    if (returnFocus) {
      // The status may have changed, which swaps the buttons. Focus the row's main action.
      afterNextRender(
        () => {
          this.elementRef.nativeElement
            .querySelector<HTMLElement>("[data-primary-action]")
            ?.focus();
        },
        { injector: this.injector },
      );
    }
  }

  protected async removeSetup(): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "sshAgentSetupRemoveTitleVfo1" },
      content: { key: "sshAgentSetupRemoveDescVfo1" },
      acceptButtonText: { key: "remove" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    this.removing.set(true);
    let removed = false;
    try {
      const results = await this.client.undo();
      removed = results.every(
        (result) => result.errorCode == null && result.status !== SshAgentSetupStepStatus.Failed,
      );
    } catch {
      removed = false;
    } finally {
      this.removing.set(false);
    }

    this.toastService.showToast({
      variant: removed ? "success" : "error",
      message: this.i18nService.t(
        removed ? "sshAgentSetupRemovedToastVfo1" : "sshAgentSetupRemoveFailedToastVfo7",
      ),
    });
    await this.refresh();
  }

  protected openHelp(): void {
    this.platformUtilsService.launchUri(SSH_AGENT_HELP_URL);
  }
}
