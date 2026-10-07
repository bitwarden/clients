import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DevicesIcon } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  NoItemsModule,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  OpenShellManagementError,
  OpenShellProviderProfile,
  OpenShellSandboxCredential,
  OpenShellVaultField,
} from "../models/openshell-management";
import { secretRefsFromCredentials } from "../utils/openshell-environments.util";
import {
  addOpenShellCredentialUnique,
  isSingleSecretProfile,
  slotFor,
} from "../utils/openshell-profile.util";

import { AgentAccessOpenShellAddCredentialDialogComponent } from "./agent-access-openshell-add-credential-dialog.component";
import { AgentAccessOpenShellSetNameDialogComponent } from "./agent-access-openshell-set-name-dialog.component";

/** How often the sandbox is asked whether it has applied a provider change. */
const APPLY_POLL_MS = 2_000;
/** Checks at 0, 2, ... 30 s; after the last the line stops claiming progress. */
const APPLY_POLL_MAX_ATTEMPTS = 16;

type ApplyState = "idle" | "waiting" | "applied" | "timedOut";

interface LoadFailure {
  error: OpenShellManagementError;
  /** Scrubbed gateway text; rendered as text only. */
  message?: string;
}

/**
 * The credentials (OpenShell providers) one sandbox can use (agent-access-architecture.md,
 * §M8.20). Lists them, removes them and opens the add dialog. Only names, ids and env-var names
 * pass through here; a credential value never reaches this component.
 *
 * A provider this app did not create (`managed === false`) is shown by name only, and offers no
 * option to delete the provider itself.
 */
@Component({
  selector: "app-agent-access-openshell-credentials",
  templateUrl: "agent-access-openshell-credentials.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    I18nPipe,
    IconButtonModule,
    NoItemsModule,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellCredentialsComponent {
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);

  readonly sandboxName = input.required<string>();

  protected readonly DevicesIcon = DevicesIcon;
  protected readonly skeletonRows = [0, 1];

  protected readonly loading = signal(true);
  protected readonly credentials = signal<OpenShellSandboxCredential[]>([]);
  protected readonly loadFailure = signal<LoadFailure | null>(null);
  /** A failed remove; the list underneath stays visible. */
  protected readonly actionFailure = signal<LoadFailure | null>(null);
  protected readonly applyState = signal<ApplyState>("idle");
  /** Best effort: without profiles the id is shown and the permission can't be changed. */
  private readonly profiles = signal<OpenShellProviderProfile[]>([]);
  /** Permissions one secret can use; the choices when changing a row's permission. */
  protected readonly eligibleProfiles = computed(() =>
    this.profiles().filter(isSingleSecretProfile),
  );
  /** The provider whose permission is being changed. */
  protected readonly changing = signal<string | null>(null);

  /** Counters and the timer handle; mutated in place, never reassigned. */
  private readonly run: {
    load: number;
    poll: number;
    timer: ReturnType<typeof setInterval> | null;
  } = { load: 0, poll: 0, timer: null };

  constructor() {
    effect(() => {
      const name = this.sandboxName();
      untracked(() => {
        this.stopApplyPolling();
        this.applyState.set("idle");
        this.actionFailure.set(null);
        void this.load(name, false);
      });
    });
    this.destroyRef.onDestroy(() => this.stopApplyPolling());
  }

  protected permissionName(credential: OpenShellSandboxCredential): string {
    const id = credential.profileId;
    return id == null ? "" : (this.profiles().find((p) => p.id === id)?.displayName ?? id);
  }

  /** Only a secret this app bound (one binding, ids known) can be moved to another permission. */
  protected canChangePermission(credential: OpenShellSandboxCredential): boolean {
    return (
      credential.managed &&
      credential.bindings.length === 1 &&
      credential.profileId != null &&
      this.eligibleProfiles().length > 1 &&
      this.eligibleProfiles().some((p) => p.id === credential.profileId)
    );
  }

  protected hostsText(profileId: string | null): string {
    const profile = this.profiles().find((p) => p.id === profileId);
    return (profile?.endpoints ?? []).map((e) => `${e.host}:${e.port}`).join(", ");
  }

  /**
   * Moves a secret to another permission. The new credential is added first and the old one
   * removed after, so a failure part-way never leaves the sandbox without the secret.
   */
  protected async changePermission(
    credential: OpenShellSandboxCredential,
    profileId: string,
  ): Promise<void> {
    const sandbox = this.sandboxName();
    const target = this.eligibleProfiles().find((p) => p.id === profileId);
    const binding = credential.bindings[0];
    const slot = target == null ? null : slotFor(target);
    if (target == null || slot == null || binding == null || profileId === credential.profileId) {
      return;
    }
    const envVar = slot.envVars[0] ?? binding.envVar;

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsCredChangeTitle" },
      content: {
        key: "agentAccessOsCredChangeContent",
        placeholders: [binding.label, target.displayName, this.hostsText(profileId)],
      },
      type: "warning",
      acceptButtonText: { key: "agentAccessOsCredChangeAccept" },
      cancelButtonText: { key: "cancel" },
    });
    if (!confirmed) {
      // The select already shows the new value; put it back.
      this.credentials.set([...this.credentials()]);
      return;
    }

    this.actionFailure.set(null);
    this.changing.set(credential.providerName);
    try {
      const added = await addOpenShellCredentialUnique({
        sandboxName: sandbox,
        profileId,
        bindings: [{ ...binding, envVar }],
      });
      if (!added.ok) {
        this.actionFailure.set({ error: added.error, message: added.message });
        return;
      }
      const removed = await ipc.agentAccess.removeOpenShellCredential({
        sandboxName: sandbox,
        providerName: credential.providerName,
        deleteProvider: true,
      });
      if (removed.ok) {
        if (sandbox === this.sandboxName()) {
          this.afterChange(sandbox);
        }
      } else {
        // The new credential is in place: keep the error visible and still wait for it to apply.
        this.actionFailure.set({ error: removed.error, message: removed.message });
        if (sandbox === this.sandboxName()) {
          this.startApplyPolling(sandbox);
        }
      }
    } finally {
      this.changing.set(null);
      if (sandbox === this.sandboxName()) {
        void this.load(sandbox, true);
      }
    }
  }

  /** What "Save as set" would keep: the secrets this app created, one binding each. */
  protected readonly capturable = computed(() => secretRefsFromCredentials(this.credentials()));
  /** Confirmation of the last "Save as set". */
  protected readonly setNotice = signal<string | null>(null);

  /** Names the set, then saves this sandbox's current secrets (ids and names only) under it. */
  protected async saveAsSet(): Promise<void> {
    const { refs, skipped } = this.capturable();
    if (refs.length === 0) {
      return;
    }
    this.setNotice.set(null);
    let savedName = "";
    const ref = AgentAccessOpenShellSetNameDialogComponent.open(this.dialogService, {
      titleKey: "agentAccessOsSetSaveTitle",
      initialName: "",
      save: async (name) => {
        const result = await ipc.agentAccess.saveOpenShellSecretSet({ name, secrets: refs });
        savedName = result.ok ? result.data.name : "";
        return result;
      },
    });
    if ((await firstValueFrom(ref.closed)) === true) {
      const saved = this.i18nService.t("agentAccessOsSetSaved", savedName);
      this.setNotice.set(
        skipped > 0
          ? `${saved} ${this.i18nService.t("agentAccessOsSetSavedSkipped", skipped)}`
          : saved,
      );
    }
  }

  protected retry(): void {
    void this.load(this.sandboxName(), false);
  }

  protected fieldKey(field: OpenShellVaultField): string {
    switch (field) {
      case "username":
        return "username";
      case "password":
        return "password";
      case "value":
        return "agentAccessOsCredFieldValue";
    }
  }

  protected errorKey(error: OpenShellManagementError): string {
    switch (error) {
      case "cliMissing":
        return "agentAccessOsCredErrorCliMissing";
      case "gatewayUnreachable":
        return "agentAccessOsCredErrorGatewayUnreachable";
      case "unsupported":
        return "agentAccessOsCredErrorUnsupported";
      default:
        return "agentAccessOsCredErrorFailed";
    }
  }

  protected async openAddDialog(): Promise<void> {
    const sandbox = this.sandboxName();
    const ref = AgentAccessOpenShellAddCredentialDialogComponent.open(this.dialogService, {
      sandboxName: sandbox,
    });
    const added = await firstValueFrom(ref.closed);
    if (added === true && sandbox === this.sandboxName()) {
      this.afterChange(sandbox);
    }
  }

  protected removeAction(credential: OpenShellSandboxCredential) {
    return () => this.removeCredential(credential);
  }

  private async removeCredential(credential: OpenShellSandboxCredential): Promise<void> {
    const sandbox = this.sandboxName();

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsCredRemoveTitle" },
      content: {
        key: "agentAccessOsCredRemoveContent",
        placeholders: [credential.providerName, sandbox],
      },
      type: "warning",
      acceptButtonText: { key: "remove" },
      cancelButtonText: { key: "cancel" },
    });
    if (!confirmed) {
      return;
    }

    // Only a provider this app created may be deleted; for the rest the choice is not offered.
    const deleteProvider = credential.managed
      ? await this.dialogService.openSimpleDialog({
          title: { key: "agentAccessOsCredDeleteProviderTitle" },
          content: {
            key: "agentAccessOsCredDeleteProviderContent",
            placeholders: [credential.providerName],
          },
          type: "warning",
          acceptButtonText: { key: "agentAccessOsCredDeleteProviderAccept" },
          cancelButtonText: { key: "agentAccessOsCredDeleteProviderKeep" },
        })
      : false;

    const result = await ipc.agentAccess.removeOpenShellCredential({
      sandboxName: sandbox,
      providerName: credential.providerName,
      deleteProvider,
    });

    if (sandbox !== this.sandboxName()) {
      return;
    }
    if (!result.ok) {
      this.actionFailure.set({ error: result.error, message: result.message });
      return;
    }
    this.afterChange(sandbox);
  }

  private afterChange(sandbox: string): void {
    this.actionFailure.set(null);
    void this.load(sandbox, true);
    this.startApplyPolling(sandbox);
  }

  /** Stale responses (the sandbox changed, or a newer load started) are dropped. */
  private async load(sandbox: string, silent: boolean): Promise<void> {
    const generation = ++this.run.load;
    if (!silent) {
      this.loading.set(true);
      this.loadFailure.set(null);
      this.credentials.set([]);
    }

    const [result, profiles] = await Promise.all([
      ipc.agentAccess.listOpenShellCredentials({ sandboxName: sandbox }),
      ipc.agentAccess.listOpenShellProfiles(),
    ]);
    if (profiles?.ok) {
      this.profiles.set(profiles.data);
    }

    if (generation !== this.run.load) {
      return;
    }
    if (result.ok) {
      this.credentials.set(result.data);
      this.loadFailure.set(null);
    } else {
      this.credentials.set([]);
      this.loadFailure.set({ error: result.error, message: result.message });
    }
    this.loading.set(false);
  }

  private startApplyPolling(sandbox: string): void {
    this.stopApplyPolling();
    const generation = ++this.run.poll;
    this.applyState.set("waiting");
    let attempts = 0;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      let applied = false;
      try {
        const result = await ipc.agentAccess.getOpenShellApplyStatus({ sandboxName: sandbox });
        applied = result.ok && result.data.applied;
      } finally {
        inFlight = false;
      }
      if (generation !== this.run.poll) {
        return;
      }
      if (applied) {
        this.stopApplyPolling();
        this.applyState.set("applied");
        return;
      }
      attempts++;
      if (attempts >= APPLY_POLL_MAX_ATTEMPTS) {
        this.stopApplyPolling();
        this.applyState.set("timedOut");
      }
    };

    void tick();
    this.run.timer = setInterval(() => void tick(), APPLY_POLL_MS);
  }

  private stopApplyPolling(): void {
    this.run.poll++;
    if (this.run.timer != null) {
      clearInterval(this.run.timer);
      this.run.timer = null;
    }
  }
}
