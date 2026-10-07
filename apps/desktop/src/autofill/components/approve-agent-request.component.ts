import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AvatarModule,
  BadgeModule,
  BitwardenIcon,
  ButtonModule,
  CalloutModule,
  SegmentedCardComponent,
  CheckboxModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormControlModule,
  IconModule,
  IconTileComponent,
  RadioButtonModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentPurpose, AgentRequester, verifiedSigner } from "../models/agent-request";

export type AgentRequestCandidate = {
  id: string;
  name: string;
  username?: string;
  /** What is released if this item is chosen. */
  fields: ("username" | "password" | "totp")[];
};

export type ApproveAgentRequestParams = {
  requester: AgentRequester;
  credential?: {
    candidates: AgentRequestCandidate[];
    purpose?: AgentPurpose;
    rememberable: boolean;
  };
  approval?: { title: string; body?: string };
  ssh?: { cipherName: string; namespace?: string; isForwarding: boolean };
};

export type ApproveAgentRequestResult = {
  approved: boolean;
  cipherId?: string;
  remember?: boolean;
};

const FIELD_LABELS = { username: "username", password: "password", totp: "verificationCodeTotp" };

type KindStyle = {
  title: string;
  leaves: string;
  approve: string;
  deny: string;
  icon: BitwardenIcon;
};

const KIND_STYLES = Object.freeze({
  run: {
    title: "agentAccessCredentialTitle",
    leaves: "agentAccessLeavesRun",
    approve: "authorize",
    deny: "deny",
    icon: "bwi-terminal",
  },
  share: {
    title: "agentAccessCredentialTitle",
    leaves: "agentAccessLeavesShare",
    approve: "share",
    deny: "deny",
    icon: "bwi-share",
  },
  ssh: {
    title: "agentAccessSshTitle",
    leaves: "agentAccessLeavesSsh",
    approve: "agentAccessSign",
    deny: "deny",
    icon: "bwi-key",
  },
  ask: {
    title: "agentAccessApprovalTitle",
    leaves: "agentAccessLeavesAsk",
    approve: "yes",
    deny: "no",
    icon: "bwi-question-circle",
  },
} satisfies Record<string, KindStyle>);
type Kind = keyof typeof KIND_STYLES;

const SHELLS = new Set(["sh", "bash", "zsh", "fish", "dash"]);

@Component({
  selector: "app-approve-agent-request",
  templateUrl: "approve-agent-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    DialogModule,
    FormControlModule,
    I18nPipe,
    IconModule,
    SegmentedCardComponent,
    IconTileComponent,
    RadioButtonModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class ApproveAgentRequestComponent {
  protected readonly params = inject<ApproveAgentRequestParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<ApproveAgentRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);

  protected readonly app = describeApp(this.params.requester, this.i18nService);
  protected readonly kind: Kind = kindOf(this.params);
  protected readonly style: KindStyle = KIND_STYLES[this.kind];
  protected readonly leaves: [string, string?] = leavesLine(this.kind, this.params.requester);
  protected readonly sshAction = sshActionKey(this.params.ssh?.namespace);
  protected readonly candidates = this.params.credential?.candidates ?? [];
  protected readonly form = new FormGroup({
    cipherId: new FormControl(this.candidates[0]?.id ?? "", { nonNullable: true }),
    remember: new FormControl(false, { nonNullable: true }),
  });

  private readonly cipherId = toSignal(this.form.controls.cipherId.valueChanges, {
    initialValue: this.form.controls.cipherId.value,
  });
  protected readonly selected = computed(() =>
    this.candidates.find((c) => c.id === this.cipherId()),
  );
  protected readonly shares = computed(() => {
    const env = Object.entries(this.params.credential?.purpose?.env ?? {});
    return (this.selected()?.fields ?? [])
      .map((field) => {
        const label = this.i18nService.t(FIELD_LABELS[field]);
        const variable = env.find(([, f]) => f === field)?.[0];
        return variable ? this.i18nService.t("agentAccessSharedAs", label, `$${variable}`) : label;
      })
      .join(" · ");
  });

  static open(dialogService: DialogService, params: ApproveAgentRequestParams) {
    return dialogService.open<ApproveAgentRequestResult, ApproveAgentRequestParams>(
      ApproveAgentRequestComponent,
      { data: params },
    );
  }

  protected approve() {
    const { cipherId, remember } = this.form.getRawValue();
    void this.dialogRef.close({ approved: true, cipherId, remember });
  }

  protected deny() {
    void this.dialogRef.close({ approved: false });
  }
}

function sshActionKey(namespace: string | undefined) {
  if (namespace === "git") {
    return "sshActionGitSign";
  }
  return namespace ? "sshActionSign" : "sshActionLogin";
}

/** Env vars mean `bw-access run` or MCP `run_with_credential`; the service drops unverified ones. */
function kindOf({ ssh, approval, credential }: ApproveAgentRequestParams): Kind {
  if (ssh) {
    return "ssh";
  }
  if (approval) {
    return "ask";
  }
  return Object.keys(credential?.purpose?.env ?? {}).length > 0 ? "run" : "share";
}

/** Who gets the login back: the peer's caller, skipping the bw-access shim; a shell says nothing. */
function leavesLine(kind: Kind, { chain }: AgentRequester): [string, string?] {
  if (kind !== "share") {
    return [KIND_STYLES[kind].leaves];
  }
  const hop = chain[0]?.name === "bw-access" ? chain[1] : chain[0];
  const name = hop?.name.replace(/^-/, "");
  return name && !SHELLS.has(name)
    ? ["agentAccessLeavesShare", name]
    : ["agentAccessLeavesShareApp"];
}

/** The app is named only with what the OS verified; the hops it went through are shown below. */
function describeApp({ app, chain }: AgentRequester, i18n: I18nService) {
  const index = chain.findIndex((hop) => hop.pid === app.pid);
  const signer = verifiedSigner(app.signer);
  const signature = signer?.organization
    ? { verified: true, detail: signer.organization }
    : signer?.id
      ? { verified: true, detail: i18n.t("agentAccessTeam", signer.id) }
      : app.exe
        ? { verified: false, detail: app.exe }
        : undefined;
  return {
    name: app.name,
    signature,
    via: chain
      .slice(0, Math.max(index, 0))
      .reverse()
      .map((hop) => hop.name)
      .join(" → "),
  };
}
