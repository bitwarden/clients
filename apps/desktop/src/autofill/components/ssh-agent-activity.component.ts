import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom, startWith, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  DialogModule,
  DialogService,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import {
  SshAgentActivity,
  SshAgentActivityOperation,
  SshAgentActivityOutcome,
} from "../models/ssh-agent-activity";

/** A log entry with its display texts resolved. */
interface ActivityRow {
  timestamp: number;
  app: string;
  hostApp?: string;
  aiAgent?: string;
  /** The server logged in to, or that forwarded the request. */
  destination?: string;
  command: string;
  keyName?: string;
  requestKey: string;
  outcomeKey: string;
  outcomeVariant: BadgeVariant;
  isForwarding: boolean;
}

// i18n keys for each answer the agent gave.
const OUTCOME_KEYS: Record<SshAgentActivityOutcome, string> = {
  [SshAgentActivityOutcome.Allowed]: "sshAgentActivityAllowed",
  [SshAgentActivityOutcome.Denied]: "sshAgentActivityDenied",
  [SshAgentActivityOutcome.Failed]: "sshAgentActivityFailed",
};

// Badge colors for each answer: green allowed, red denied, grey when undecided.
const OUTCOME_VARIANTS: Record<SshAgentActivityOutcome, BadgeVariant> = {
  [SshAgentActivityOutcome.Allowed]: "success",
  [SshAgentActivityOutcome.Denied]: "danger",
  [SshAgentActivityOutcome.Failed]: "subtle",
};

const GIT_NAMESPACE = "git";

/**
 * Shows which apps used the SSH agent, with which command, and how each request was answered.
 */
@Component({
  selector: "app-ssh-agent-activity",
  templateUrl: "ssh-agent-activity.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonModule, DatePipe, DialogModule, I18nPipe, TableModule],
})
export class SshAgentActivityComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly messageListener = inject(MessageListener);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<ActivityRow[]>([]);

  static open(dialogService: DialogService) {
    return dialogService.open(SshAgentActivityComponent);
  }

  ngOnInit() {
    // Reload the log on open and whenever the agent answers another request.
    this.messageListener
      .messages$(new CommandDefinition(SSH_AGENT_IPC_CHANNELS.ACTIVITY))
      .pipe(
        startWith(null),
        switchMap(() => ipc.autofill.sshAgent.activityLog()),
        switchMap(async (log) => this.toRows(log, await this.keyNames())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => this.rows.set(rows));
  }

  // Names of the active vault's items by id. Empty while the vault is locked.
  private async keyNames(): Promise<Map<string, string>> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account == null) {
      return new Map();
    }

    const ciphers = await firstValueFrom(this.cipherService.cipherViews$(account.id));
    return new Map((ciphers ?? []).map((cipher) => [cipher.id, cipher.name]));
  }

  private toRows(log: SshAgentActivity[], keyNames: Map<string, string>): ActivityRow[] {
    return log.map((entry) => ({
      timestamp: entry.timestamp,
      // The program that asked, e.g. `ssh`, shown with the app it runs in.
      app: entry.processName ?? entry.callerApp ?? entry.hostApp ?? "",
      // Only worth showing when it adds something, e.g. `claude` in `iTerm2`.
      hostApp: entry.hostApp !== entry.processName ? entry.hostApp : undefined,
      aiAgent: entry.aiAgent,
      destination: SshAgentActivityComponent.isLogin(entry) ? entry.destination : undefined,
      command: entry.command ?? entry.processName ?? "",
      keyName: entry.cipherId != null ? keyNames.get(entry.cipherId) : undefined,
      requestKey: SshAgentActivityComponent.requestKey(entry),
      outcomeKey: OUTCOME_KEYS[entry.outcome],
      outcomeVariant: OUTCOME_VARIANTS[entry.outcome],
      isForwarding: entry.isForwarding,
    }));
  }

  // Whether `entry` signed a server login; git and file signatures name no server.
  private static isLogin(entry: SshAgentActivity): boolean {
    return entry.operation === SshAgentActivityOperation.Sign && entry.namespace == null;
  }

  // The i18n key describing what the client asked for.
  private static requestKey(entry: SshAgentActivity): string {
    if (entry.operation === SshAgentActivityOperation.List) {
      return "sshAgentActivityListKeys";
    }
    if (entry.namespace === GIT_NAMESPACE) {
      return "sshAgentActivityGitSign";
    }
    if (entry.namespace != null) {
      return "sshAgentActivitySign";
    }
    return "sshAgentActivityLogin";
  }
}
