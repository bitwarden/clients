import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  DialogService,
  CalloutModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RequestContext } from "../models/ssh-request-context";

export interface ApproveSshRequestParams {
  cipherName: string;
  applicationName: string;
  isAgentForwarding: boolean;
  action: string;
  context: RequestContext | null;
}

const NOISE_PROCESS_NAMES = new Set([
  "sh",
  "bash",
  "zsh",
  "fish",
  "dash",
  "tmux",
  "screen",
  "login",
  "sshd",
  "systemd",
  "init",
]);

const FRIENDLY_NAMES: Record<string, string> = {
  Code: "Visual Studio Code",
  "Code - Insiders": "VS Code Insiders",
  "code-insiders": "VS Code Insiders",
  cursor: "Cursor",
  iterm2: "iTerm",
  Terminal: "Terminal",
};

function basename(path: string | null | undefined): string | null {
  if (!path) {return null;}
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? null;
}

function stripExe(name: string): string {
  return name.toLowerCase().endsWith(".exe") ? name.slice(0, -4) : name;
}

function friendlyAppName(ctx: RequestContext | null, fallback: string): string {
  if (!ctx) {return fallback;}
  const candidates = [basename(ctx.app.executablePath), ctx.app.processName].filter(
    (s): s is string => !!s,
  );
  for (const c of candidates) {
    const stripped = stripExe(c);
    if (FRIENDLY_NAMES[c]) {return FRIENDLY_NAMES[c];}
    if (FRIENDLY_NAMES[stripped]) {return FRIENDLY_NAMES[stripped];}
  }
  return basename(ctx.app.executablePath) ?? ctx.app.processName ?? fallback;
}

function nearestNonNoiseAncestor(ctx: RequestContext): string | null {
  // parentChain is root → leaf; the leaf is the requester itself.
  // Walk from the leaf's parent (length - 2) toward the root.
  const chain = ctx.app.parentChain;
  if (chain.length < 2) {return null;}
  for (let i = chain.length - 2; i >= 0; i--) {
    const name = stripExe(chain[i].name);
    if (!NOISE_PROCESS_NAMES.has(name)) {
      return FRIENDLY_NAMES[chain[i].name] ?? FRIENDLY_NAMES[name] ?? chain[i].name;
    }
  }
  return null;
}

export interface ProseParts {
  subject: string;
  parent: string | null;
  cipherName: string;
  hostClause: string | null; // "github.com" or "user@github.com"
  actionFallbackKey: string; // i18n key when no host present
  showVerifiedBadge: boolean;
  showUnverifiedBadge: boolean;
}

export function buildProseParts(params: ApproveSshRequestParams): ProseParts {
  const ctx = params.context;
  const subject = friendlyAppName(ctx, params.applicationName);
  const parent = ctx ? nearestNonNoiseAncestor(ctx) : null;

  let hostClause: string | null = null;
  let showVerified = false;
  let showUnverified = false;
  if (ctx?.host.hostname) {
    const host = ctx.host.hostname;
    hostClause = ctx.host.username ? `${ctx.host.username}@${host}` : host;
    showVerified = ctx.host.source === "known-hosts";
    showUnverified = ctx.host.source === "argv";
  }

  return {
    subject,
    parent,
    cipherName: params.cipherName,
    hostClause,
    actionFallbackKey: params.action,
    showVerifiedBadge: showVerified,
    showUnverifiedBadge: showUnverified,
  };
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-approve-ssh-request",
  templateUrl: "approve-ssh-request.html",
  imports: [
    DialogModule,
    CommonModule,
    I18nPipe,
    ButtonModule,
    IconButtonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    FormFieldModule,
    CalloutModule,
  ],
})
export class ApproveSshRequestComponent {
  approveSshRequestForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: ApproveSshRequestParams,
    private dialogRef: DialogRef<boolean>,
    private formBuilder: FormBuilder,
  ) {}

  static open(
    dialogService: DialogService,
    cipherName: string,
    applicationName: string,
    isAgentForwarding: boolean,
    namespace: string,
    context: RequestContext | null,
  ) {
    let actioni18nKey = "sshActionLogin";
    if (namespace === "git") {
      actioni18nKey = "sshActionGitSign";
    } else if (namespace != null && namespace != "") {
      actioni18nKey = "sshActionSign";
    }

    return dialogService.open<boolean, ApproveSshRequestParams>(ApproveSshRequestComponent, {
      data: {
        cipherName,
        applicationName,
        isAgentForwarding,
        action: actioni18nKey,
        context,
      },
    });
  }

  get proseParts(): ProseParts {
    return buildProseParts(this.params);
  }

  get hasRichContext(): boolean {
    return this.params.context != null;
  }

  submit = async () => {
    await this.dialogRef.close(true);
  };
}
