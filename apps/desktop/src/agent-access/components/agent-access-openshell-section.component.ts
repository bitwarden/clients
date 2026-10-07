import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { distinctUntilChanged } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CalloutModule,
  CopyClickDirective,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  FormControlModule,
  FormFieldModule,
  IconComponent,
  RadioButtonModule,
  SpinnerComponent,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";
import {
  coerceOpenShellApprovalLifetime,
  OPENSHELL_TTL_CHOICES_MINUTES,
  OpenShellDetectionResult,
  OpenShellLifetimeMode,
  OpenShellSetupResult,
  OpenShellSetupStatus,
  OpenShellSnippet,
  OpenShellTtlMinutes,
} from "../models/openshell";

/** How often the driver's "last seen" is polled while waiting for the gateway to connect. */
const CONNECT_POLL_MS = 1_000;
/** After this long without a connection the panel stops saying "waiting" and says what to check. */
const CONNECT_TIMEOUT_MS = 30_000;

type SetupPhase = "running" | "connected" | "failed" | "waiting" | "timedOut" | "idle";

/**
 * The "OpenShell" section of the Agent Access Setup tab (agent-access-architecture.md, §M8.9).
 *
 * Rendered only when Agent Access is on, OpenShell is detected, and this isn't Windows. On Snap or
 * AppImage it shows why the integration isn't available and offers no toggle. Otherwise it offers
 * the toggle (default off) and, once on: the approval-lifetime picker, the `gateway.toml` snippet
 * to copy by hand, the provider/attach examples and the rules that go with them.
 *
 * Nothing here writes a file or runs an OpenShell binary: detection is read-only, the snippet is
 * text, and the listener follows the setting through `DesktopAgentAccessService`.
 */
@Component({
  selector: "app-agent-access-openshell-section",
  templateUrl: "agent-access-openshell-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    I18nPipe,
    ReactiveFormsModule,
    ButtonModule,
    CalloutModule,
    CopyClickDirective,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    FormControlModule,
    FormFieldModule,
    IconComponent,
    RadioButtonModule,
    SpinnerComponent,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SwitchComponent,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellSectionComponent implements OnInit {
  private readonly desktopSettingsService = inject(DesktopSettingsService);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detection = signal<OpenShellDetectionResult | null>(null);
  protected readonly snippet = signal<OpenShellSnippet | null>(null);
  protected readonly driverLastSeenMs = signal<number | null>(null);

  protected readonly setupStatus = signal<OpenShellSetupStatus | null>(null);
  protected readonly setupResult = signal<OpenShellSetupResult | null>(null);
  protected readonly setupBusy = signal(false);
  /** `Date.now()` from which a driver connection counts as the result of the setup just run. */
  private readonly watchSinceMs = signal<number | null>(null);
  protected readonly waitTimedOut = signal(false);
  private readonly poll: { handle: ReturnType<typeof setInterval> | null } = { handle: null };

  /** Disclosures for the parts most people never need: the manual route and the lifetime choice. */
  protected readonly manualOpen = signal(false);
  protected readonly lifetimeOpen = signal(false);

  /** A driver connection made after the watch started — the proof that setup worked. */
  private readonly connectedSinceWatch = computed(() => {
    const seen = this.driverLastSeenMs();
    const since = this.watchSinceMs();
    return seen != null && since != null && seen >= since;
  });

  protected readonly phase = computed<SetupPhase>(() => {
    if (this.setupBusy()) {
      return "running";
    }
    if (this.connectedSinceWatch()) {
      return "connected";
    }
    const result = this.setupResult();
    if (result != null && !result.ok) {
      return "failed";
    }
    if (this.watchSinceMs() != null) {
      return this.waitTimedOut() ? "timedOut" : "waiting";
    }
    if (this.setupStatus()?.configured && this.driverLastSeenMs() != null) {
      return "connected";
    }
    return "idle";
  });

  /** The i18n key explaining a failed setup. */
  protected readonly failureKey = computed(() => {
    switch (this.setupResult()?.failure) {
      case "unmergeable":
        return "agentAccessOpenShellSetupFailUnmergeable";
      case "notWritable":
        return "agentAccessOpenShellSetupFailNotWritable";
      case "restartFailed":
        return this.setupResult()?.restartMethod === "manual"
          ? "agentAccessOpenShellSetupFailRestartManual"
          : "agentAccessOpenShellSetupFailRestart";
      case "noBundledCli":
        return "agentAccessOpenShellSetupFailNoCli";
      default:
        return "agentAccessOpenShellSetupFailGeneric";
    }
  });

  protected readonly agentAccessEnabled = toSignal(
    this.desktopSettingsService.agentAccessEnabled$,
    {
      initialValue: false,
    },
  );
  protected readonly openShellEnabled = toSignal(
    this.desktopSettingsService.agentAccessOpenShellEnabled$,
    { initialValue: false },
  );

  protected readonly enabledControl = new FormControl(false, { nonNullable: true });
  protected readonly modeControl = new FormControl<OpenShellLifetimeMode>("ttl", {
    nonNullable: true,
  });
  protected readonly ttlControl = new FormControl<OpenShellTtlMinutes>(60, { nonNullable: true });
  /** Mirrors `modeControl` for the OnPush template (the TTL picker shows only for `ttl`). */
  protected readonly mode = signal<OpenShellLifetimeMode>("ttl");

  protected readonly ttlOptions = OPENSHELL_TTL_CHOICES_MINUTES.map((minutes) => ({
    value: minutes,
    label:
      minutes < 60
        ? this.i18nService.t("agentAccessOpenShellTtlMinutes", minutes)
        : this.i18nService.t("agentAccessOpenShellTtlHours", minutes / 60),
  }));

  private readonly isWindows = ipc.platform.deviceType === DeviceType.WindowsDesktop;

  /** Not rendered at all: Agent Access off, nothing detected, or Windows. */
  readonly visible = computed(() => {
    const detection = this.detection();
    return (
      !this.isWindows &&
      this.agentAccessEnabled() &&
      detection != null &&
      detection.present &&
      detection.unsupportedReason !== "windows"
    );
  });

  /** Snap / AppImage: show the reason, never the toggle. */
  protected readonly unsupportedReasonKey = computed(() => {
    const detection = this.detection();
    if (detection == null || detection.platformSupported) {
      return null;
    }
    if (detection.unsupportedReason === "snap") {
      return "agentAccessOpenShellUnsupportedSnap";
    }
    if (detection.unsupportedReason === "appImage") {
      return "agentAccessOpenShellUnsupportedAppImage";
    }
    return null;
  });

  protected readonly unsupportedAuthGateways = computed(
    () => this.detection()?.gateways.filter((gateway) => !gateway.authSupported) ?? [],
  );

  async ngOnInit(): Promise<void> {
    this.desktopSettingsService.agentAccessOpenShellEnabled$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.enabledControl.setValue(enabled, { emitEvent: false }));
    this.desktopSettingsService.agentAccessOpenShellApprovalLifetime$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lifetime) => {
        this.modeControl.setValue(lifetime.mode, { emitEvent: false });
        this.mode.set(lifetime.mode);
        this.ttlControl.setValue(lifetime.ttlMinutes, { emitEvent: false });
      });

    this.enabledControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => void this.setEnabled(enabled));
    this.modeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.mode.set(mode);
      void this.saveLifetime();
    });
    this.ttlControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.saveLifetime());

    this.destroyRef.onDestroy(() => this.stopPolling());
    await this.refresh();
  }

  protected async runSetup(): Promise<void> {
    await this.runSetupCall(() => ipc.agentAccess.runOpenShellSetup());
  }

  protected async removeSetup(): Promise<void> {
    await this.runSetupCall(() => ipc.agentAccess.removeOpenShellSetup());
    // The driver is out of the config now; whatever it last said no longer describes this setup.
    this.stopPolling();
    this.watchSinceMs.set(null);
  }

  private async runSetupCall(call: () => Promise<OpenShellSetupResult>): Promise<void> {
    this.setupBusy.set(true);
    this.setupResult.set(null);
    this.waitTimedOut.set(false);
    this.stopPolling();
    this.watchSinceMs.set(null);
    try {
      const result = await call();
      this.setupResult.set(result);
      // After a restart the driver reconnects on its own; after a failed restart the user does it,
      // and the same connection is still the proof, so watch in both cases.
      if (result.ok || result.configChanged) {
        this.startWatching(result.restartedAtMs ?? Date.now());
      }
    } finally {
      this.setupBusy.set(false);
      this.setupStatus.set(await ipc.agentAccess.getOpenShellSetupStatus());
    }
  }

  private startWatching(sinceMs: number): void {
    this.watchSinceMs.set(sinceMs);
    const startedAt = Date.now();
    this.poll.handle = setInterval(() => {
      void (async () => {
        this.driverLastSeenMs.set(await ipc.agentAccess.getOpenShellDriverLastSeen());
        if (this.connectedSinceWatch()) {
          this.stopPolling();
          // A connection after a manual restart supersedes the "restart it yourself" message.
          this.setupResult.set(null);
        } else if (Date.now() - startedAt >= CONNECT_TIMEOUT_MS) {
          this.waitTimedOut.set(true);
          this.stopPolling();
        }
      })();
    }, CONNECT_POLL_MS);
  }

  private stopPolling(): void {
    if (this.poll.handle != null) {
      clearInterval(this.poll.handle);
      this.poll.handle = null;
    }
  }

  protected async refresh(): Promise<void> {
    if (this.isWindows) {
      return;
    }
    const detection = await ipc.agentAccess.detectOpenShell();
    this.detection.set(detection);
    if (detection.present && detection.platformSupported) {
      this.snippet.set(await ipc.agentAccess.getOpenShellSnippet());
      this.driverLastSeenMs.set(await ipc.agentAccess.getOpenShellDriverLastSeen());
      this.setupStatus.set(await ipc.agentAccess.getOpenShellSetupStatus());
    }
  }

  private async setEnabled(enabled: boolean): Promise<void> {
    const detection = this.detection();
    // Never turn it on from a state where the toggle isn't even offered.
    if (enabled && (detection == null || !detection.present || !detection.platformSupported)) {
      this.enabledControl.setValue(false, { emitEvent: false });
      return;
    }
    await this.desktopSettingsService.setAgentAccessOpenShellEnabled(enabled);
  }

  private async saveLifetime(): Promise<void> {
    await this.desktopSettingsService.setAgentAccessOpenShellApprovalLifetime(
      coerceOpenShellApprovalLifetime({
        mode: this.modeControl.value,
        ttlMinutes: this.ttlControl.value,
      }),
    );
  }
}
