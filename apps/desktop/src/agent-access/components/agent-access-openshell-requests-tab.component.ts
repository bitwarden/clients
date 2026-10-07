import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  OnInit,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import {
  BadgeComponent,
  ButtonModule,
  CalloutModule,
  DialogService,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  OpenShellManagementError,
  OpenShellManagementResult,
} from "../models/openshell-management";
import { OpenShellRequest, OpenShellRequestEndpoint } from "../models/openshell-requests";
import { OpenShellRequestsCountService } from "../services/openshell-requests-count.service";

import { AgentAccessOpenShellApproveRequestDialogComponent } from "./agent-access-openshell-approve-request-dialog.component";
import { AgentAccessOpenShellPermissionDialogComponent } from "./agent-access-openshell-permission-dialog.component";

const POLL_MS = 10_000;
const DEFAULT_PORT = 443;

type RequestsView = "pending" | "history";

/** The program's file name, for a sentence ("curl"); the full path is shown as text beside it. */
export function openShellRequestProgramName(path: string): string {
  const name = path
    .split("/")
    .filter((part) => part !== "")
    .pop();
  return name ?? path;
}

/** `host`, or `host:port` when the port is not the default HTTPS one. */
export function openShellRequestTarget(endpoint: OpenShellRequestEndpoint): string {
  return endpoint.port === DEFAULT_PORT ? endpoint.host : `${endpoint.host}:${endpoint.port}`;
}

/**
 * "Requests" tab of a sandbox (agent-access-architecture.md, §M8.20 rule 16): what the agents in
 * the sandbox tried to reach and were blocked from, one plain-language card each, with Approve,
 * Deny, or "Create permission instead" (the permission dialog prefilled). There is no approve-all,
 * and a flagged request needs a second, explicit confirmation.
 *
 * Everything in a request came from the gateway and is untrusted: it is shown as text only (never
 * as markup), and only the chunk id goes back to main. Refreshes every 10 seconds while the tab is
 * open (the component lives only while its route is active) and the window is visible.
 */
@Component({
  selector: "app-agent-access-openshell-requests-tab",
  templateUrl: "agent-access-openshell-requests-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    I18nPipe,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    ToggleGroupModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellRequestsTabComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly dialogService = inject(DialogService);
  private readonly counts = inject(OpenShellRequestsCountService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  protected readonly name = toSignal(
    this.route.parent.paramMap.pipe(map((params) => params.get("name"))),
    { initialValue: this.route.parent.snapshot.paramMap.get("name") },
  );

  protected readonly view = signal<RequestsView>("pending");
  protected readonly loading = signal(true);
  protected readonly requests = signal<OpenShellRequest[]>([]);
  protected readonly failure = signal<{ error: OpenShellManagementError; message?: string } | null>(
    null,
  );
  protected readonly actionFailure = signal<{ message?: string } | null>(null);
  /** The request an action is running for; its buttons wait, the others stay usable. */
  protected readonly busyId = signal<string | null>(null);

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
    this.destroyRef.onDestroy(() => {
      this.poll.sequence++;
      if (this.poll.handle != null) {
        clearInterval(this.poll.handle);
        this.poll.handle = null;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Outside the Angular zone so a repeating timer never keeps the app "unstable"; each refresh
    // runs back inside it.
    this.poll.handle = this.zone.runOutsideAngular(() =>
      setInterval(() => {
        if (!document.hidden && this.busyId() == null) {
          this.zone.run((): void => void this.load(true));
        }
      }, POLL_MS),
    );
    await this.load(false);
  }

  protected async setView(value: string): Promise<void> {
    this.view.set(value === "history" ? "history" : "pending");
    this.requests.set([]);
    await this.load(false);
  }

  protected retry(): Promise<void> {
    return this.load(false);
  }

  protected isPending(request: OpenShellRequest): boolean {
    return request.status === "pending";
  }

  protected target(endpoint: OpenShellRequestEndpoint): string {
    return openShellRequestTarget(endpoint);
  }

  protected programName(request: OpenShellRequest): string {
    return request.programs.length > 0 ? openShellRequestProgramName(request.programs[0]) : "";
  }

  /** Opens the approval popup for a request and acts on what the user decides there. */
  protected async review(request: OpenShellRequest): Promise<void> {
    const ref = AgentAccessOpenShellApproveRequestDialogComponent.open(this.dialogService, {
      sandboxName: this.name(),
      request,
    });
    const result = await firstValueFrom(ref.closed);
    switch (result?.decision) {
      case "approve":
        await this.approve(request);
        break;
      case "deny":
        await this.deny(request);
        break;
      case "createPermission":
        await this.createPermission(request);
        break;
    }
  }

  protected async approve(request: OpenShellRequest): Promise<void> {
    if (request.flagged) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "agentAccessOsReqFlaggedConfirmTitle" },
        content: { key: "agentAccessOsReqFlaggedConfirmContent" },
        type: "warning",
        acceptButtonText: { key: "agentAccessOsReqFlaggedConfirmAccept" },
        cancelButtonText: { key: "cancel" },
      });
      if (!confirmed) {
        return;
      }
    }
    await this.act(request, () =>
      ipc.agentAccess.approveOpenShellRequest({
        sandboxName: this.name(),
        chunkId: request.id,
        ...(request.flagged ? { confirmFlagged: true } : {}),
      }),
    );
  }

  protected async deny(request: OpenShellRequest): Promise<void> {
    await this.act(request, () =>
      ipc.agentAccess.rejectOpenShellRequest({ sandboxName: this.name(), chunkId: request.id }),
    );
  }

  /** Opens the permission dialog with the host, port and program of this request filled in. */
  protected async createPermission(request: OpenShellRequest): Promise<void> {
    const endpoint = request.endpoints[0];
    if (endpoint == null) {
      return;
    }
    // Best effort: lets the dialog flag a name clash before asking the gateway.
    const profiles = await ipc.agentAccess.listOpenShellProfiles();
    const ref = AgentAccessOpenShellPermissionDialogComponent.open(this.dialogService, {
      existingIds: profiles.ok ? profiles.data.map((profile) => profile.id) : [],
      prefill: {
        host: endpoint.host,
        port: endpoint.port,
        ...(request.programs.length > 0 ? { program: request.programs[0] } : {}),
      },
    });
    await firstValueFrom(ref.closed);
  }

  private async act(
    request: OpenShellRequest,
    run: () => Promise<{ ok: boolean; message?: string }>,
  ): Promise<void> {
    this.actionFailure.set(null);
    this.busyId.set(request.id);
    try {
      const result = await run();
      if (!result.ok) {
        this.actionFailure.set({ message: result.message?.trim() });
      }
    } finally {
      // Never assume it worked: re-read, then release the buttons.
      await this.load(true);
      this.busyId.set(null);
    }
  }

  private async load(silent: boolean): Promise<void> {
    const sequence = ++this.poll.sequence;
    const view = this.view();
    if (!silent) {
      this.loading.set(true);
    }
    const sandboxName = this.name();
    const result =
      view === "pending"
        ? await ipc.agentAccess.listOpenShellRequests({ sandboxName, status: "pending" })
        : await this.loadDecided(sandboxName);
    if (sequence !== this.poll.sequence) {
      return;
    }
    if (result.ok) {
      this.failure.set(null);
      this.requests.set(result.data);
      if (view === "pending") {
        this.counts.set(sandboxName, result.data.length);
      }
    } else if (!silent || this.requests().length === 0) {
      this.requests.set([]);
      this.failure.set({ error: result.error, message: result.message });
    }
    this.loading.set(false);
  }

  /** Approved and rejected, newest first as the gateway lists them. */
  private async loadDecided(
    sandboxName: string,
  ): Promise<OpenShellManagementResult<OpenShellRequest[]>> {
    const [approved, rejected] = await Promise.all([
      ipc.agentAccess.listOpenShellRequests({ sandboxName, status: "approved" }),
      ipc.agentAccess.listOpenShellRequests({ sandboxName, status: "rejected" }),
    ]);
    if (!approved.ok) {
      return approved;
    }
    if (!rejected.ok) {
      return rejected;
    }
    return { ok: true, data: [...approved.data, ...rejected.data] };
  }
}
