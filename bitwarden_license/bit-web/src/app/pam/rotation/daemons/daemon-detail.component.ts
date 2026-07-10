import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

import { DaemonStatus, PamApiService, RotationDaemonDetailsResponse } from "@bitwarden/bit-pam";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BreadcrumbsModule,
  ButtonModule,
  CardComponent,
  DialogService,
  HeaderComponent,
  IconModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { RotationHistoryComponent } from "../managed-credentials/rotation-history.component";
import { TargetSystemsService } from "../target-systems/target-systems.service";

/**
 * Routed detail page for a single rotation daemon — a sibling of the rotation shell (own
 * header + breadcrumbs, no tab bar), matching the target-system / rotation-config detail
 * pages. Reached from the daemons tab by clicking a daemon name.
 *
 * Shows the daemon's status, connection, assigned target systems (name-resolved via a
 * page-scoped {@link TargetSystemsService}), and its recent rotation activity (jobs +
 * attempts) via the shared {@link RotationHistoryComponent}.
 */
@Component({
  templateUrl: "./daemon-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TargetSystemsService],
  imports: [
    CommonModule,
    AsyncActionsModule,
    BadgeModule,
    BreadcrumbsModule,
    ButtonModule,
    CardComponent,
    HeaderComponent,
    IconModule,
    RotationHistoryComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class DaemonDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pamApi = inject(PamApiService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  /** Exposed for template comparisons (status badge variant). */
  protected readonly DaemonStatus = DaemonStatus;

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly daemonId = this.route.snapshot.params.daemonId as string;

  protected readonly loading = signal(true);
  protected readonly daemon = signal<RotationDaemonDetailsResponse | null>(null);

  private readonly systemById = toSignal(this.targetSystemsService.systemById$, {
    initialValue: new Map(),
  });

  /** Assigned target-system display names, falling back to the raw ID when not yet resolved. */
  protected readonly assignmentNames = computed(() => {
    const daemon = this.daemon();
    if (daemon == null) {
      return [];
    }
    const map = this.systemById();
    return daemon.assignments.map((id) => map.get(id)?.name ?? id);
  });

  protected readonly titleText = computed(() => this.daemon()?.name ?? "");

  /** True when the daemon is enabled (Enrolled) — drives Disable vs Enable in the header. */
  protected readonly enabled = computed(() => this.daemon()?.status === DaemonStatus.Enrolled);

  constructor() {
    void this.initialize();
  }

  /** Disable the daemon (reversible); confirms first. */
  protected readonly disable = async (): Promise<void> => {
    const daemon = this.daemon();
    if (daemon == null) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamDaemonDisableConfirmTitle" },
      content: { key: "pamDaemonDisableConfirmContent", placeholders: [daemon.name] },
      acceptButtonText: { key: "pamDaemonDisable" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.pamApi.disableRotationDaemon(this.organizationId, daemon.id);
      this.patchStatus(DaemonStatus.Revoked);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamDaemonDisabled"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /** Re-enable a disabled daemon. */
  protected readonly enable = async (): Promise<void> => {
    const daemon = this.daemon();
    if (daemon == null) {
      return;
    }
    try {
      await this.pamApi.enableRotationDaemon(this.organizationId, daemon.id);
      this.patchStatus(DaemonStatus.Enrolled);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamDaemonEnabled"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /** Delete the daemon permanently after confirming, then return to the list. */
  protected readonly deleteDaemon = async (): Promise<void> => {
    const daemon = this.daemon();
    if (daemon == null) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamDaemonDeleteConfirmTitle" },
      content: { key: "pamDaemonDeleteConfirmContent", placeholders: [daemon.name] },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.pamApi.deleteRotationDaemon(this.organizationId, daemon.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamDaemonDeleted"),
      });
      await this.navigateToList();
    } catch (e) {
      this.showError(e);
    }
  };

  private async initialize(): Promise<void> {
    try {
      const [daemon] = await Promise.all([
        this.loadDaemon(),
        // Load target systems so assignment IDs resolve to names.
        this.targetSystemsService.load(this.organizationId),
      ]);
      if (daemon != null) {
        this.daemon.set(daemon);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDaemon(): Promise<RotationDaemonDetailsResponse | null> {
    try {
      return await this.pamApi.getRotationDaemon(this.organizationId, this.daemonId);
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamDaemonNotFound"),
      });
      await this.navigateToList();
      return null;
    }
  }

  private navigateToList(): Promise<boolean> {
    return this.router.navigate([".."], { relativeTo: this.route });
  }

  /** Patch the loaded daemon's status locally, preserving its prototype (and jobs) for the template. */
  private patchStatus(status: DaemonStatus): void {
    const daemon = this.daemon();
    if (daemon == null) {
      return;
    }
    this.daemon.set(
      Object.assign(Object.create(Object.getPrototypeOf(daemon)), daemon, {
        status,
      }) as RotationDaemonDetailsResponse,
    );
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
