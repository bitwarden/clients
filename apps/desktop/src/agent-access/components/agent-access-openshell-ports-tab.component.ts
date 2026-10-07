import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  BadgeComponent,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { isOpenShellPort, OpenShellManagementError } from "../models/openshell-management";
import {
  isOpenShellLoopbackBind,
  OPENSHELL_MAX_PORT_NAME_CHARS,
  OPENSHELL_MAX_SAVED_PORTS,
  OpenShellForward,
  openShellForwardUrl,
  OpenShellSavedPort,
} from "../models/openshell-ports";
import { AgentAccessOpenShellPortsCountService } from "../services/agent-access-openshell-ports-count.service";

interface PortRow {
  port: number;
  /** Friendly name from the saved entry; `""` when none or not saved. */
  name: string;
  saved: boolean;
  active: boolean;
  /** As the CLI reports it; `""` when it doesn't say or the forward isn't active. */
  bindAddress: string;
  /** `true` when the forward may be reachable from other machines. */
  exposed: boolean;
}

interface Failure {
  error: OpenShellManagementError;
  /** Scrubbed CLI text; rendered as text only. */
  message?: string;
}

/**
 * "Ports" tab of a sandbox (agent-access-architecture.md, §M8.20 rule 15): the sandbox's active
 * port forwards merged with the ports the user saved for it. Starting one sends only the sandbox
 * name and a port number; main always binds it to loopback and uses the same port number on both
 * ends. "Open in browser" opens `http://localhost:<port>` through the app's external-link path.
 * Names and port numbers only, never a value.
 */
@Component({
  selector: "app-agent-access-openshell-ports-tab",
  templateUrl: "agent-access-openshell-ports-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    ReactiveFormsModule,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellPortsTabComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly countService = inject(AgentAccessOpenShellPortsCountService);

  protected readonly maxNameChars = OPENSHELL_MAX_PORT_NAME_CHARS;

  protected readonly name = toSignal(
    this.route.parent.paramMap.pipe(map((params) => params.get("name"))),
    { initialValue: this.route.parent.snapshot.paramMap.get("name") },
  );

  protected readonly loading = signal(true);
  protected readonly forwards = signal<OpenShellForward[]>([]);
  protected readonly savedPorts = signal<OpenShellSavedPort[]>([]);
  protected readonly failure = signal<Failure | null>(null);
  protected readonly actionFailure = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly portError = signal(false);

  protected readonly form = this.formBuilder.group({
    port: [""],
    friendlyName: [""],
    save: [true],
  });

  protected readonly rows = computed<PortRow[]>(() => {
    const byPort = new Map<number, PortRow>();
    for (const saved of this.savedPorts()) {
      byPort.set(saved.port, {
        port: saved.port,
        name: saved.name,
        saved: true,
        active: false,
        bindAddress: "",
        exposed: false,
      });
    }
    for (const forward of this.forwards()) {
      const existing = byPort.get(forward.port);
      byPort.set(forward.port, {
        port: forward.port,
        name: existing?.name ?? "",
        saved: existing != null,
        active: true,
        bindAddress: forward.bindAddress,
        exposed: !isOpenShellLoopbackBind(forward.bindAddress),
      });
    }
    return [...byPort.values()].sort((a, b) => a.port - b.port);
  });

  protected readonly startableSaved = computed(() =>
    this.rows().filter((r) => r.saved && !r.active),
  );

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

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async refresh(): Promise<void> {
    await this.load();
  }

  protected async startNew(): Promise<void> {
    const raw = String(this.form.controls.port.value ?? "").trim();
    const port = /^[0-9]{1,5}$/.test(raw) ? Number(raw) : NaN;
    if (!isOpenShellPort(port)) {
      this.portError.set(true);
      return;
    }
    this.portError.set(false);
    const friendlyName = (this.form.controls.friendlyName.value ?? "").trim();
    const save = this.form.controls.save.value === true;
    const started = await this.start(port);
    if (started && save) {
      await this.saveRow(port, friendlyName);
    }
    if (started) {
      this.form.patchValue({ port: "", friendlyName: "" });
    }
  }

  protected async startRow(row: PortRow): Promise<void> {
    await this.start(row.port);
  }

  protected async startAllSaved(): Promise<void> {
    const ports = this.startableSaved().map((row) => row.port);
    this.actionFailure.set(null);
    this.busy.set(true);
    try {
      for (const port of ports) {
        if (!(await this.startOne(port))) {
          break;
        }
      }
    } finally {
      await this.reloadForwards();
      this.busy.set(false);
    }
  }

  protected async stopRow(row: PortRow): Promise<void> {
    const sandboxName = this.name();
    if (sandboxName == null) {
      return;
    }
    this.actionFailure.set(null);
    this.busy.set(true);
    try {
      const result = await ipc.agentAccess.stopOpenShellForward({ sandboxName, port: row.port });
      if (!result.ok) {
        this.actionFailure.set(this.messageOf(result.message));
      }
    } finally {
      await this.reloadForwards();
      this.busy.set(false);
    }
  }

  protected openInBrowser(row: PortRow): void {
    const url = openShellForwardUrl(row.port);
    if (url != null) {
      this.platformUtilsService.launchUri(url);
    }
  }

  protected async remember(row: PortRow): Promise<void> {
    await this.saveRow(row.port, row.name);
  }

  protected async forget(row: PortRow): Promise<void> {
    const sandboxName = this.name();
    if (sandboxName == null) {
      return;
    }
    await this.writeSaved(
      sandboxName,
      this.savedPorts().filter((saved) => saved.port !== row.port),
    );
  }

  private async start(port: number): Promise<boolean> {
    this.actionFailure.set(null);
    this.busy.set(true);
    try {
      return await this.startOne(port);
    } finally {
      await this.reloadForwards();
      this.busy.set(false);
    }
  }

  private async startOne(port: number): Promise<boolean> {
    const sandboxName = this.name();
    if (sandboxName == null) {
      return false;
    }
    const result = await ipc.agentAccess.startOpenShellForward({ sandboxName, port });
    if (!result.ok) {
      this.actionFailure.set(this.messageOf(result.message));
    }
    return result.ok;
  }

  private async saveRow(port: number, friendlyName: string): Promise<void> {
    const sandboxName = this.name();
    if (sandboxName == null) {
      return;
    }
    if (
      this.savedPorts().length >= OPENSHELL_MAX_SAVED_PORTS &&
      !this.savedPorts().some((saved) => saved.port === port)
    ) {
      this.actionFailure.set(this.i18nService.t("agentAccessOsPortsSavedLimit"));
      return;
    }
    await this.writeSaved(sandboxName, [
      ...this.savedPorts().filter((saved) => saved.port !== port),
      { port, name: friendlyName.slice(0, OPENSHELL_MAX_PORT_NAME_CHARS) },
    ]);
  }

  private async writeSaved(sandboxName: string, ports: OpenShellSavedPort[]): Promise<void> {
    const result = await ipc.agentAccess.setOpenShellSavedPorts({ sandboxName, ports });
    if (result.ok) {
      this.savedPorts.set(result.data);
    } else {
      this.actionFailure.set(this.messageOf(result.message));
    }
  }

  private async load(): Promise<void> {
    const sandboxName = this.name();
    if (sandboxName == null) {
      return;
    }
    this.loading.set(true);
    const [forwards, saved] = await Promise.all([
      ipc.agentAccess.listOpenShellForwards({ sandboxName }),
      ipc.agentAccess.getOpenShellSavedPorts({ sandboxName }),
    ]);
    if (forwards.ok) {
      this.failure.set(null);
      this.forwards.set(forwards.data);
      this.countService.set(sandboxName, forwards.data.length);
    } else {
      this.failure.set({ error: forwards.error, message: forwards.message });
    }
    if (saved.ok) {
      this.savedPorts.set(saved.data);
    }
    this.loading.set(false);
  }

  /** Never assume a start or stop worked: ask the CLI what it is forwarding now. */
  private async reloadForwards(): Promise<void> {
    const sandboxName = this.name();
    if (sandboxName == null) {
      return;
    }
    const forwards = await ipc.agentAccess.listOpenShellForwards({ sandboxName });
    if (forwards.ok) {
      this.forwards.set(forwards.data);
      this.countService.set(sandboxName, forwards.data.length);
    }
  }

  private messageOf(message: string | undefined): string {
    return message?.trim() || this.i18nService.t("agentAccessOsPageErrorFailed");
  }
}
