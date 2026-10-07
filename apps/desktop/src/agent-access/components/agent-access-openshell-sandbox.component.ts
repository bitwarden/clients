import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterOutlet } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeComponent,
  BadgeVariant,
  BreadcrumbsModule,
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  MenuModule,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TabsModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OpenShellSandboxMeta } from "../models/openshell-environments";
import { OpenShellManagementError, OpenShellSandbox } from "../models/openshell-management";
import { AgentAccessOpenShellPortsCountService } from "../services/agent-access-openshell-ports-count.service";
import { OpenShellRequestsCountService } from "../services/openshell-requests-count.service";
import {
  clearOpenShellSandboxMeta,
  OPENSHELL_META_COLOR_CLASS,
  secretRefsFromCredentials,
} from "../utils/openshell-environments.util";
import { openShellPhaseKind } from "../utils/openshell-phase.util";

import { AgentAccessOpenShellDetailsDialogComponent } from "./agent-access-openshell-details-dialog.component";
import { AgentAccessOpenShellEnvironmentDialogComponent } from "./agent-access-openshell-environment-dialog.component";
import { AgentAccessOpenShellOpenButtonComponent } from "./agent-access-openshell-open-button.component";

const POLL_MS = 5_000;

/**
 * One sandbox's page (agent-access-architecture.md, §M8.20), laid out like a Secrets Manager machine
 * account: breadcrumb back to the list, the sandbox as the title, and a tab per concern (Secrets,
 * Permissions). The tabs are child routes and read the sandbox name from this route.
 *
 * The sandbox is looked up in the gateway list (there is no single-sandbox read). A sandbox that
 * isn't in it gets a "not found" state rather than empty tabs.
 */
@Component({
  selector: "app-agent-access-openshell-sandbox",
  templateUrl: "agent-access-openshell-sandbox.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAccessOpenShellOpenButtonComponent,
    BadgeComponent,
    BreadcrumbsModule,
    ButtonModule,
    CalloutModule,
    DatePipe,
    I18nPipe,
    IconButtonModule,
    MenuModule,
    RouterOutlet,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TabsModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellSandboxComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly portsCount = inject(AgentAccessOpenShellPortsCountService);
  private readonly requestsCount = inject(OpenShellRequestsCountService);

  protected readonly name = toSignal(
    this.route.paramMap.pipe(map((params) => params.get("name"))),
    {
      initialValue: this.route.snapshot.paramMap.get("name"),
    },
  );

  protected readonly sandbox = signal<OpenShellSandbox | null>(null);
  protected readonly loading = signal(true);
  protected readonly failure = signal<{ error: OpenShellManagementError; message?: string } | null>(
    null,
  );
  protected readonly actionError = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** Port forwards of this sandbox; kept current by the Ports tab. `null` until first read. */
  protected readonly forwardCount = computed(() => this.portsCount.countFor(this.name()));
  /** Pending agent permission requests, for the Requests tab badge (§M8.20 rule 16). */
  protected readonly pendingRequests = computed(() => this.requestsCount.pendingFor(this.name()));
  protected readonly isReady = computed(
    () => openShellPhaseKind(this.sandbox()?.phase) === "ready",
  );
  protected readonly isStopped = computed(
    () => openShellPhaseKind(this.sandbox()?.phase) === "stopped",
  );
  protected readonly phaseVariant = computed<BadgeVariant>(() => {
    switch (openShellPhaseKind(this.sandbox()?.phase)) {
      case "ready":
        return "success";
      case "stopped":
        return "subtle";
      case "error":
        return "danger";
      default:
        return "warning";
    }
  });
  protected readonly failureKey = computed(() => {
    switch (this.failure()?.error) {
      case "cliMissing":
        return "agentAccessOsPageErrorCliMissing";
      case "gatewayUnreachable":
        return "agentAccessOsPageErrorGatewayUnreachable";
      case "unsupported":
        return "agentAccessOsPageErrorUnsupported";
      default:
        return "agentAccessOsPageErrorFailed";
    }
  });

  private readonly poll: { handle: ReturnType<typeof setInterval> | null; sequence: number } = {
    handle: null,
    sequence: 0,
  };

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => void this.load(false));
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.requestsCount.refresh(this.name()));
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  protected refresh(): Promise<void> {
    return this.load(false);
  }

  protected async start(): Promise<void> {
    await this.runAction("start");
  }

  protected async stop(): Promise<void> {
    await this.runAction("stop");
  }

  /** Purpose and accent color the user wrote for this sandbox (kept by this app, not the gateway). */
  protected readonly meta = signal<OpenShellSandboxMeta | null>(null);
  protected readonly metaColorClass = computed(() => {
    const color = this.meta()?.color;
    return color == null ? null : OPENSHELL_META_COLOR_CLASS[color];
  });
  /** A confirmation of the last "Save as environment". */
  protected readonly actionNotice = signal<string | null>(null);

  protected async editDetails(): Promise<void> {
    const name = this.name();
    if (name == null) {
      return;
    }
    const ref = AgentAccessOpenShellDetailsDialogComponent.open(this.dialogService, {
      sandboxName: name,
      meta: this.meta(),
    });
    const saved = await firstValueFrom(ref.closed);
    if (saved !== undefined && name === this.name()) {
      this.meta.set(saved);
    }
  }

  /**
   * Opens the environment dialog with this sandbox's current secrets (the ones this app created)
   * ready to keep. The gateway record has no image or size, so the user enters those.
   */
  protected async saveAsEnvironment(): Promise<void> {
    const name = this.name();
    if (name == null) {
      return;
    }
    this.actionError.set(null);
    this.actionNotice.set(null);
    const [credentials, sets] = await Promise.all([
      ipc.agentAccess.listOpenShellCredentials({ sandboxName: name }),
      ipc.agentAccess.listOpenShellSecretSets(),
    ]);
    if (!credentials.ok) {
      this.actionError.set(
        credentials.message?.trim() || this.i18nService.t("agentAccessOsPageErrorFailed"),
      );
      return;
    }
    const { refs, skipped } = secretRefsFromCredentials(credentials.data);
    const ref = AgentAccessOpenShellEnvironmentDialogComponent.open(this.dialogService, {
      sets: sets.ok ? sets.data : [],
      inlineSecrets: refs,
      skippedSecrets: skipped,
      prefill: { name, description: this.meta()?.purpose ?? "" },
    });
    const saved = await firstValueFrom(ref.closed);
    if (saved != null) {
      this.actionNotice.set(this.i18nService.t("agentAccessOsEnvSaved", saved.name));
    }
  }

  protected async delete(): Promise<void> {
    const name = this.name();
    if (name == null) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsPageDeleteTitle" },
      content: { key: "agentAccessOsPageDeleteContent", placeholders: [name] },
      acceptButtonText: { key: "delete" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    if (await this.runAction("delete")) {
      await clearOpenShellSandboxMeta(name);
      await this.router.navigate(["/agent-access/openshell"]);
    }
  }

  /** Returns `true` when the gateway accepted the action. */
  private async runAction(action: "start" | "stop" | "delete"): Promise<boolean> {
    const name = this.name();
    if (name == null) {
      return false;
    }
    this.actionError.set(null);
    this.busy.set(true);
    let accepted = false;
    try {
      const result = await ipc.agentAccess.openShellSandboxAction({ action, name });
      accepted = result.ok;
      if (!result.ok) {
        this.actionError.set(
          result.message?.trim() || this.i18nService.t("agentAccessOsPageErrorFailed"),
        );
      }
    } finally {
      // Never assume it worked: re-read, then release the buttons.
      if (action !== "delete") {
        await this.load(true);
      }
      this.busy.set(false);
    }
    return accepted;
  }

  private async load(silent: boolean): Promise<void> {
    const sequence = ++this.poll.sequence;
    if (!silent) {
      this.loading.set(true);
    }
    const result = await ipc.agentAccess.listOpenShellSandboxes();
    if (sequence !== this.poll.sequence) {
      return;
    }
    if (result.ok) {
      this.failure.set(null);
      this.sandbox.set(result.data.find((sandbox) => sandbox.name === this.name()) ?? null);
      void this.seedForwardCount();
      void this.loadMeta(sequence);
    } else if (!silent || this.sandbox() == null) {
      this.sandbox.set(null);
      this.failure.set({ error: result.error, message: result.message });
    }
    this.loading.set(false);
    this.syncPolling();
  }

  /** Best effort: without it the page simply has no purpose line. */
  private async loadMeta(sequence: number): Promise<void> {
    try {
      const result = await ipc.agentAccess.getOpenShellSandboxMeta();
      if (result.ok && sequence === this.poll.sequence) {
        this.meta.set(result.data.find((entry) => entry.name === this.name()) ?? null);
      }
    } catch {
      // Metadata is optional.
    }
  }

  /** Reads the forward count once per sandbox so the Ports tab shows it before it is opened. */
  private async seedForwardCount(): Promise<void> {
    const name = this.name();
    if (name == null || this.sandbox() == null || this.portsCount.countFor(name) != null) {
      return;
    }
    try {
      const result = await ipc.agentAccess.listOpenShellForwards({ sandboxName: name });
      if (result.ok) {
        this.portsCount.set(name, result.data.length);
      }
    } catch {
      // The count is a nicety; the Ports tab reports a real failure itself.
    }
  }

  private syncPolling(): void {
    const settling = this.sandbox() != null && openShellPhaseKind(this.sandbox().phase) === "other";
    if (settling && this.poll.handle == null) {
      this.poll.handle = setInterval(() => void this.load(true), POLL_MS);
    } else if (!settling) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.poll.handle != null) {
      clearInterval(this.poll.handle);
      this.poll.handle = null;
    }
  }
}
