import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule, PopoverModule } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  CoachmarkComponent,
  CoachmarkService,
  CoachmarkStepId,
  pamAdminTour,
} from "@bitwarden/vault";

/**
 * Admin tour item steps in display order. Adding a step (e.g. Governance) is one entry here, one
 * entry in `visibleStepIds`, and one anchor in the template.
 */
const PAM_ADMIN_STEP_IDS = ["pamAccessRules", "pamAuditLog", "pamRotation"] as const;

/**
 * PAM nav group in the Admin Console organization side nav. Each item mirrors its route's guard,
 * so the group never renders an item that would redirect.
 */
@Component({
  selector: "app-pam-org-nav-slot",
  templateUrl: "./pam-org-nav-slot.component.html",
  host: { class: "tw-contents" },
  imports: [I18nPipe, NavigationModule, PopoverModule, CoachmarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamOrgNavSlotComponent {
  private readonly configService = inject(ConfigService);
  private readonly stateProvider = inject(StateProvider);
  private readonly injector = inject(Injector);
  protected readonly coachmark = inject(CoachmarkService);

  readonly organization = input.required<Organization>();

  // No initial value: `undefined` means "not resolved yet", which the tour waits out so its step
  // list is never built from a flag's placeholder `false`.
  private readonly pamFlag = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam));
  private readonly rotationFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PamAccessConnector),
  );
  private readonly pamEnabled = computed(() => this.pamFlag() === true);
  private readonly rotationEnabled = computed(() => this.rotationFlag() === true);
  private readonly flagsResolved = computed(
    () => this.pamFlag() !== undefined && this.rotationFlag() !== undefined,
  );
  protected readonly showAccessRules = computed(
    () => this.pamEnabled() && this.organization().canManageAccessRules,
  );
  protected readonly showAuditLog = computed(
    () => this.pamEnabled() && this.organization().usePam && this.organization().canAccessEventLogs,
  );
  protected readonly showRotation = computed(
    () => this.pamEnabled() && this.rotationEnabled() && this.organization().canManageRotation,
  );
  protected readonly showPam = computed(
    () => this.showAccessRules() || this.showAuditLog() || this.showRotation(),
  );

  /** The nav group, so the tour can expand it without owning its router-seeded open state. */
  private readonly navGroup = viewChild<{ setOpen(isOpen: boolean): void }>("navGroup");

  /** Same predicates as the template, so every id passed to the tour has a rendered anchor. */
  private readonly visibleStepIds = computed<readonly CoachmarkStepId[]>(() => {
    const visible: Record<(typeof PAM_ADMIN_STEP_IDS)[number], boolean> = {
      pamAccessRules: this.showAccessRules(),
      pamAuditLog: this.showAuditLog(),
      pamRotation: this.showRotation(),
    };
    return PAM_ADMIN_STEP_IDS.filter((id) => visible[id]);
  });

  /** The organization the tour was last requested for, so switching organizations re-requests it. */
  private readonly tourRequestedFor = signal<string | null>(null);

  constructor() {
    // Start once the group and its items have rendered, so every step has an anchor. The engine
    // skips the tour if the user already completed it.
    effect(() => {
      const orgId = this.organization().id;
      if (!this.showPam() || !this.flagsResolved() || this.tourRequestedFor() === orgId) {
        return;
      }
      const ids = this.visibleStepIds();
      untracked(() => this.tourRequestedFor.set(orgId));
      untracked(() =>
        afterNextRender(
          () => void this.coachmark.startTour(pamAdminTour(this.stateProvider, ids)),
          { injector: this.injector },
        ),
      );
    });

    // The items sit inside the group, so keep it expanded while the tour is on one of them.
    effect(() => {
      const onItem = PAM_ADMIN_STEP_IDS.some((id) => this.coachmark.isStepActive(id));
      if (onItem) {
        this.navGroup()?.setOpen(true);
      }
    });
  }
}
