import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

import { DaemonStatus, PamApiService, RotationDaemonDetailsResponse } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  BreadcrumbsModule,
  CardComponent,
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
    BadgeModule,
    BreadcrumbsModule,
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

  constructor() {
    void this.initialize();
  }

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
}
