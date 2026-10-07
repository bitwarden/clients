import { inject, Injectable, OnDestroy } from "@angular/core";
import {
  catchError,
  combineLatest,
  concatMap,
  EMPTY,
  filter,
  firstValueFrom,
  mergeMap,
  Subject,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { CopyCipherFieldService, PasswordRepromptService } from "@bitwarden/vault";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import {
  AgentRequestCandidate,
  ApproveAgentRequestComponent,
} from "../components/approve-agent-request.component";
import { AgentAccessPromptType } from "../models/agent-access-setting";
import {
  AgentCredential,
  AgentCredentialField,
  AgentCredentialQuery,
  AgentOutcome,
  AgentOutcomeStatus,
  AgentRequest,
  AgentRequester,
  AgentRequestKind,
  AgentSshSign,
  verifiedSigner,
} from "../models/agent-request";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentRequestGate } from "./agent-request-gate.service";

const MAX_CANDIDATES = 10;

type Release = { cipher: CipherView; fields: AgentCredentialField[] };

/** `run` keeps the secrets in the command's environment; `share` returns them to the caller. */
type Mode = "run" | "share";

/** SSH signs share the channel but are answered by `SshAgentService`. */
type AccessRequest = AgentRequest<Exclude<AgentRequestKind, AgentSshSign>>;

/** Answers local agent requests (credentials and yes/no questions) through the shared gate. */
@Injectable({ providedIn: "root" })
export class AgentAccessService implements OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly copyCipherFieldService = inject(CopyCipherFieldService);
  private readonly dialogService = inject(DialogService);
  private readonly gate = inject(AgentRequestGate);
  private readonly logService = inject(LogService);
  private readonly messageListener = inject(MessageListener);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly settings = inject(DesktopSettingsService);
  private readonly totpService = inject(TotpService);
  private readonly destroy$ = new Subject<void>();

  async init() {
    this.messageListener
      .messages$(new CommandDefinition<AgentRequest>(AGENT_ACCESS_IPC_CHANNELS.REQUEST))
      .pipe(
        filter((request): request is AccessRequest => request.kind.type !== "sshSign"),
        withLatestFrom(this.settings.agentAccessEnabled$),
        mergeMap(([request, enabled]) =>
          this.gate.run<AgentOutcome>({
            label: `agent ${request.kind.type} request`,
            enabled,
            unlock: {
              requiredMessage: "agentAccessUnlockRequired",
              timeoutMessage: "agentAccessUnlockTimeout",
              timeoutMs: Math.max(0, request.deadline - Date.now()),
            },
            refused: { status: AgentOutcomeStatus.Denied },
            locked: { status: AgentOutcomeStatus.Locked },
            handle: (userId) => this.handle(request, userId),
            respond: (outcome) => ipc.autofill.agentAccess.respond(request.requestId, outcome),
          }),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();

    combineLatest([this.settings.agentAccessEnabled$, this.accountService.activeAccount$])
      .pipe(
        concatMap(async ([enabled, account]) => {
          const running = await ipc.autofill.agentAccess.isLoaded();
          if (enabled && account != null && !running) {
            await ipc.autofill.agentAccess.init();
          } else if (!(enabled && account != null) && running) {
            await ipc.autofill.agentAccess.stop();
          }
        }),
        catchError((e: unknown) => {
          this.logService.error("Agent access listener lifecycle stopped", e);
          return EMPTY;
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    await ipc.autofill.agentAccess.ready();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async handle(request: AccessRequest, userId: UserId): Promise<AgentOutcome> {
    const { kind, requester, deadline } = request;

    if (kind.type === "approval") {
      const result = await this.gate.confirm(
        () => ApproveAgentRequestComponent.open(this.dialogService, { requester, approval: kind }),
        deadline,
      );
      return { status: toStatus(result?.approved, deadline) };
    }

    const ciphers = await this.find(kind.query, userId);
    if (ciphers.length === 0) {
      return { status: AgentOutcomeStatus.NotFound };
    }
    // The dialog shows the fields; values are read on approval, so a TOTP code is current.
    const releases = await Promise.all(ciphers.map((cipher) => this.release(cipher)));

    // Only the bundled CLI is known to honor `env`; anyone else gets the credential back.
    const purpose = requester.bundledCli
      ? kind.purpose
      : kind.purpose && { ...kind.purpose, env: {} };
    const mode: Mode = Object.keys(purpose?.env ?? {}).length > 0 ? "run" : "share";
    const promptType = await firstValueFrom(this.settings.agentAccessPromptBehavior$);
    const scope =
      promptType === AgentAccessPromptType.RememberUntilLock
        ? rememberScope(requester, mode)
        : undefined;
    const [only] = releases;
    if (
      scope != null &&
      releases.length === 1 &&
      only.cipher.reprompt === CipherRepromptType.None &&
      this.gate.remembered.has(`${scope}:${only.cipher.id}`)
    ) {
      return { status: AgentOutcomeStatus.Approved, credential: await this.credential(only) };
    }

    const result = await this.gate.confirm(
      () =>
        ApproveAgentRequestComponent.open(this.dialogService, {
          requester,
          credential: {
            candidates: releases.map(toCandidate),
            purpose,
            rememberable: scope != null,
          },
        }),
      deadline,
    );
    const chosen = releases.find((r) => r.cipher.id === result?.cipherId);
    if (!result?.approved || chosen == null) {
      return { status: toStatus(result?.approved, deadline) };
    }
    if (!(await this.passwordRepromptService.passwordRepromptCheck(chosen.cipher))) {
      return { status: AgentOutcomeStatus.Denied };
    }
    if (scope != null && result.remember && chosen.cipher.reprompt === CipherRepromptType.None) {
      this.gate.remembered.add(`${scope}:${chosen.cipher.id}`);
    }
    return { status: AgentOutcomeStatus.Approved, credential: await this.credential(chosen) };
  }

  private async find(query: AgentCredentialQuery, userId: UserId): Promise<CipherView[]> {
    const usable = (c: CipherView) => c.type === CipherType.Login && !c.isDeleted && !c.isArchived;

    let ciphers: CipherView[];
    if (query.domain != null) {
      const url = query.domain.includes("://") ? query.domain : `https://${query.domain}`;
      ciphers = await this.cipherService.getAllDecryptedForUrl(url, userId);
    } else {
      const all = await this.cipherService.getAllDecrypted(userId);
      const search = query.search?.toLowerCase();
      ciphers = all.filter((c) =>
        query.id != null ? c.id === query.id : !!search && c.name?.toLowerCase().includes(search),
      );
    }
    return ciphers.filter(usable).slice(0, MAX_CANDIDATES);
  }

  /** Honors `viewPassword` and TOTP licensing, as the vault does. */
  private async release(cipher: CipherView): Promise<Release> {
    const { login, viewPassword } = cipher;
    const totp = viewPassword && (await this.copyCipherFieldService.totpAllowed(cipher));
    const fields: AgentCredentialField[] = [];
    if (login.username) {
      fields.push("username");
    }
    if (viewPassword && login.password) {
      fields.push("password");
    }
    if (totp) {
      fields.push("totp");
    }
    return { cipher, fields };
  }

  private async credential({ cipher, fields }: Release): Promise<AgentCredential> {
    const { login } = cipher;
    return {
      credentialId: cipher.id,
      username: fields.includes("username") ? login.username : undefined,
      password: fields.includes("password") ? login.password : undefined,
      totp: fields.includes("totp") ? await this.totpCode(login.totp) : undefined,
      uri: login.uris?.[0]?.uri ?? undefined,
    };
  }

  private async totpCode(secret: string | undefined): Promise<string | undefined> {
    if (!secret) {
      return undefined;
    }
    try {
      return (await firstValueFrom(this.totpService.getCode$(secret)))?.code;
    } catch (e) {
      this.logService.error("Failed to generate a TOTP code for an agent request", e);
      return undefined;
    }
  }
}

/** A dialog closed without an answer was dismissed, unless the deadline closed it. */
function toStatus(approved: boolean | undefined, deadline: number): AgentOutcomeStatus {
  if (approved === undefined && Date.now() >= deadline) {
    return AgentOutcomeStatus.Timeout;
  }
  return approved ? AgentOutcomeStatus.Approved : AgentOutcomeStatus.Denied;
}

function toCandidate({ cipher, fields }: Release): AgentRequestCandidate {
  return { id: cipher.id, name: cipher.name, username: cipher.login.username, fields };
}

/** Per verified signer, else executable path, and per mode; none when neither is known. */
function rememberScope({ app }: AgentRequester, mode: Mode): string | undefined {
  const signer = verifiedSigner(app.signer);
  const identity = signer?.id != null ? `${signer.kind}:${signer.id}` : app.exe && `exe:${app.exe}`;
  return identity ? `agent:${mode}:${identity}` : undefined;
}
