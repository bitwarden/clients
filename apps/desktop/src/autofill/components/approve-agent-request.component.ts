import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormControlModule,
  RadioButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentPurpose, AgentRequester } from "../models/agent-request";

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

@Component({
  selector: "app-approve-agent-request",
  templateUrl: "approve-agent-request.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    DialogModule,
    FormControlModule,
    I18nPipe,
    RadioButtonModule,
    ReactiveFormsModule,
  ],
})
export class ApproveAgentRequestComponent {
  protected readonly params = inject<ApproveAgentRequestParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<ApproveAgentRequestResult>>(DialogRef);
  private readonly i18nService = inject(I18nService);

  protected readonly app = describeApp(this.params.requester);
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

/** The app is named only with what the OS verified; the hops it went through are shown below. */
function describeApp({ app, chain }: AgentRequester) {
  const index = chain.findIndex((hop) => hop.pid === app.pid);
  const verified = app.signer?.valid === true;
  return {
    name: app.name,
    organization: verified ? app.signer?.organization : undefined,
    exe: verified ? undefined : app.exe,
    via: chain
      .slice(0, Math.max(index, 0))
      .reverse()
      .map((hop) => hop.name)
      .join(" → "),
  };
}
