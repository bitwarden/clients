import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { StopClickDirective } from "@bitwarden/angular/directives/stop-click.directive";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  CopyClickDirective,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The bare CLI invocation used in generated commands for a remote agent — it installs its own
 * `aac`, so a path into this app's bundle would be meaningless there. */
const AAC_CLI_NAME = "aac";

/** Where users get the `aac` CLI referenced by the generated pairing command. */
const AGENT_ACCESS_SETUP_URL = "https://github.com/bitwarden/agent-access";

/**
 * Pairs a new *remote* agent — one running on another machine, reached over the relay with a PSK
 * token. Agents on this computer no longer pair at all: they get a local transport and a
 * first-use, OS-mediated authorization prompt instead (see `agent-access-architecture.md`), which
 * has no token to generate or copy and so needs no dialog like this one.
 *
 * Two steps: name the agent (which also generates its token), then hand over the token and the
 * command that consumes it. Viewing/removing already-paired agents lives on the Agent Access page
 * — see `AgentAccessAgentsComponent`.
 */
@Component({
  selector: "app-agent-access-pair-agent-dialog",
  templateUrl: "agent-access-pair-agent-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CopyClickDirective,
    DialogModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    LinkModule,
    ReactiveFormsModule,
    StopClickDirective,
    TypographyModule,
  ],
})
export class AgentAccessPairAgentDialogComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly pairForm = this.formBuilder.group({
    agentName: [""],
  });

  protected readonly agentRunning = signal(false);
  protected readonly loading = signal(true);

  /** The generated pairing token. Non-null means the dialog is on its second step. */
  protected readonly credential = signal<string | null>(null);

  /** A ready-to-run `aac connect` invocation with the token already substituted. */
  protected readonly pairCommand = computed(() => {
    const credential = this.credential();
    if (credential === null) {
      return null;
    }
    return `${AAC_CLI_NAME} connect --token ${credential}`;
  });

  /**
   * A paste-ready block telling an agent how to use Agent Access once it has been paired. We
   * can't detect which runtime is being paired well enough to install a skill file for it, so the
   * usage instructions travel with the paste — but the live PSK token never does. That token is a
   * vault-access credential (see `agentAccessPskTokenWarning`), and pairing itself is something
   * the human does out of band, with their own copy of the token, via the "Run by hand" field
   * below — never by asking an agent's chat to run a command containing it.
   */
  protected readonly agentPrompt = computed(() => {
    if (this.credential() === null) {
      return null;
    }
    return this.i18nService.t("agentAccessAgentPromptRemote", AAC_CLI_NAME);
  });

  static open(dialogService: DialogService) {
    return dialogService.open(AgentAccessPairAgentDialogComponent);
  }

  async ngOnInit() {
    this.loading.set(true);
    try {
      this.agentRunning.set(await ipc.agentAccess.isLoaded());
    } finally {
      this.loading.set(false);
    }
  }

  protected openSetupDocs() {
    this.platformUtilsService.launchUri(AGENT_ACCESS_SETUP_URL);
  }

  protected readonly generatePairingCredential = async () => {
    const name = this.pairForm.value.agentName?.trim() || null;
    // Reusable so the same token can pair the agent again without regenerating it — an ephemeral
    // remote (a fresh CI container) has no cached session to fall back on. Never persisted here.
    this.credential.set(await ipc.agentAccess.generatePskToken(name, true));
  };
}
