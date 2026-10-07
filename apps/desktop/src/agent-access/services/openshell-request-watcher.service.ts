import { inject, Injectable, OnDestroy } from "@angular/core";
import {
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  firstValueFrom,
  Observable,
  Subject,
  switchMap,
  takeUntil,
  timer,
} from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { AgentAccessOpenShellApproveRequestDialogComponent } from "../components/agent-access-openshell-approve-request-dialog.component";
import { AgentAccessOpenShellPermissionDialogComponent } from "../components/agent-access-openshell-permission-dialog.component";
import { OpenShellRequest } from "../models/openshell-requests";
import { openShellPhaseKind } from "../utils/openshell-phase.util";

import { OpenShellRequestsCountService } from "./openshell-requests-count.service";

const POLL_MS = 15_000;

/**
 * Opens the approval popup on its own when an agent in a running sandbox is blocked
 * (agent-access-architecture.md, §M8.20 rule 16), like the other agent-access approval popups.
 *
 * It polls only while `active$` is true (Agent Access and OpenShell on, vault unlocked), shows one
 * popup at a time, and shows each request once per session: dismissing a popup decides nothing and
 * leaves the request waiting in the sandbox's Requests tab. Requests are untrusted gateway text;
 * only the chunk id goes back to main, and a flagged request still needs the second confirmation.
 */
@Injectable({ providedIn: "root" })
export class OpenShellRequestWatcherService implements OnDestroy {
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly i18nService = inject(I18nService);
  private readonly counts = inject(OpenShellRequestsCountService);
  private readonly destroy$ = new Subject<void>();
  /** Chunk ids already put in front of the user this session. Ids only. */
  private readonly shown = new Set<string>();

  start(active$: Observable<boolean>): void {
    active$
      .pipe(
        distinctUntilChanged(),
        switchMap((active) => {
          if (!active) {
            this.shown.clear();
            return EMPTY;
          }
          return timer(0, POLL_MS);
        }),
        exhaustMap(() => this.check()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async check(): Promise<void> {
    if (document.hidden) {
      return;
    }
    try {
      const sandboxes = await ipc.agentAccess.listOpenShellSandboxes();
      if (!sandboxes.ok) {
        return;
      }
      for (const sandbox of sandboxes.data) {
        if (openShellPhaseKind(sandbox.phase) !== "ready") {
          continue;
        }
        const pending = await ipc.agentAccess.listOpenShellRequests({
          sandboxName: sandbox.name,
          status: "pending",
        });
        if (!pending.ok) {
          continue;
        }
        this.counts.set(sandbox.name, pending.data.length);
        const next = pending.data.find((request) => !this.shown.has(request.id));
        if (next != null) {
          this.shown.add(next.id);
          await this.review(sandbox.name, next);
          // One popup per round; the next waiting request opens on the following one.
          return;
        }
      }
    } catch (e) {
      this.logService.error("Agent Access: could not check for OpenShell requests", e);
    }
  }

  private async review(sandboxName: string, request: OpenShellRequest): Promise<void> {
    const ref = AgentAccessOpenShellApproveRequestDialogComponent.open(this.dialogService, {
      sandboxName,
      request,
    });
    const result = await firstValueFrom(ref.closed);
    switch (result?.decision) {
      case "approve":
        await this.approve(sandboxName, request);
        break;
      case "deny":
        await this.report(
          await ipc.agentAccess.rejectOpenShellRequest({ sandboxName, chunkId: request.id }),
        );
        break;
      case "createPermission":
        await this.createPermission(request);
        break;
    }
    const after = await ipc.agentAccess.listOpenShellRequests({
      sandboxName,
      status: "pending",
    });
    if (after.ok) {
      this.counts.set(sandboxName, after.data.length);
    }
  }

  private async approve(sandboxName: string, request: OpenShellRequest): Promise<void> {
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
    await this.report(
      await ipc.agentAccess.approveOpenShellRequest({
        sandboxName,
        chunkId: request.id,
        ...(request.flagged ? { confirmFlagged: true } : {}),
      }),
    );
  }

  private async createPermission(request: OpenShellRequest): Promise<void> {
    const endpoint = request.endpoints[0];
    if (endpoint == null) {
      return;
    }
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

  private async report(result: { ok: boolean; message?: string }): Promise<void> {
    if (!result.ok) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("agentAccessOsReqActionFailed"),
        message: result.message?.trim() ?? "",
      });
    }
  }
}
