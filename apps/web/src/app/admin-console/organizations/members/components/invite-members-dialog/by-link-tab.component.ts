import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import {
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { OrganizationDomainsService } from "@bitwarden/common/admin-console/abstractions/organization-domain/organization-domains.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DefaultServerSettingsService } from "@bitwarden/common/platform/services/default-server-settings.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  FormControlModule,
  FormFieldModule,
  IconButtonModule,
  LinkComponent,
  PopoverModule,
  SwitchComponent,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import {
  OrganizationInviteLink,
  OrganizationInviteLinkService,
} from "@bitwarden/organization-invite-link";
import { I18nPipe } from "@bitwarden/ui-common";

function parseDomains(rawDomains: string | null | undefined): string[] {
  return (rawDomains ?? "")
    .split(",")
    .map((domain) => domain.trim())
    .filter((domain) => domain.length > 0);
}

@Component({
  standalone: true,
  selector: "app-by-link-tab",
  templateUrl: "by-link-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CommonModule,
    FormControlModule,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    PopoverModule,
    ReactiveFormsModule,
    LinkComponent,
    SwitchComponent,
    TooltipDirective,
  ],
})
export class ByLinkTabComponent {
  readonly organizationId = input.required<OrganizationId, string>({
    transform: (value: string) => value as OrganizationId,
  });

  readonly showCoachMarks = input<boolean>(false);

  readonly tourStep = signal<number>(0);

  // TODO(coachmark cleanup): remove domainsInput and injector along with the rest of the
  // guided tour (showCoachMarks, tourStep, and the effect() below in the constructor). They
  // exist only to work around the step 1 popover's backdrop blocking clicks into the page — see
  // the focus() call sites in save() for the other half of this workaround.
  protected readonly domainsInput = viewChild<ElementRef<HTMLInputElement>>("domainsInput");

  private readonly injector = inject(Injector);
  private readonly accountService = inject(AccountService);
  private readonly inviteLinkService = inject(OrganizationInviteLinkService);
  private readonly organizationDomainsService = inject(OrganizationDomainsService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly fb = inject(FormBuilder);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly eventCollectionService = inject(EventCollectionService);
  private readonly serverSettingsService = inject(DefaultServerSettingsService);

  private readonly isSelfHost = this.platformUtilsService.isSelfHost();
  private readonly emailVerificationDisabled = toSignal(
    this.serverSettingsService.isEmailVerificationDisabled$,
    { initialValue: false },
  );
  protected readonly showSelfHostWarning = computed(
    () => this.isSelfHost && this.emailVerificationDisabled(),
  );
  private readonly configService = inject(ConfigService);
  private readonly validationService = inject(ValidationService);

  /**
   * Gates the "require admin confirmation" toggle. While off, links keep being created without
   * confirmation support, which is the pre-toggle behaviour.
   */
  protected readonly autoConfirmEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.InviteLinkAutoConfirm),
    { initialValue: false },
  );

  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly inviteLink$: Observable<OrganizationInviteLink | undefined> = combineLatest([
    this.userId$,
    toObservable(this.organizationId),
  ]).pipe(
    switchMap(([userId, orgId]) => this.inviteLinkService.inviteLink$(userId, orgId)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected readonly inviteLinkUrl$: Observable<string> = combineLatest([
    this.userId$,
    toObservable(this.organizationId),
    this.inviteLink$.pipe(filter((link) => link != null)),
  ]).pipe(
    switchMap(([userId, orgId, inviteLink]) =>
      this.inviteLinkService.reconstructUrl(userId, orgId, inviteLink),
    ),
  );

  readonly hasInviteLinkUrl$: Observable<boolean> = this.inviteLink$.pipe(
    map((inviteLink) => inviteLink != null),
  );

  readonly form = this.fb.group({
    domains: ["", Validators.required],
  });

  /**
   * The inverse of the link's `supportsConfirmation`: confirmation support means invitees
   * self-confirm, so requiring an admin means turning it off.
   *
   * Deliberately kept out of {@link form}. This switch saves the moment it is flipped, so folding
   * it into the domains form would mark that form dirty and block the copy button on an edit the
   * user never made.
   */
  readonly requireAdminConfirmation = new FormControl(false, { nonNullable: true });

  readonly domainsEmpty = toSignal(
    this.form.controls.domains.valueChanges.pipe(
      map((v) => parseDomains(v).length === 0),
      startWith(true),
    ),
    { initialValue: true },
  );

  private readonly prefillAttempted = signal(false);
  private readonly tourStarted = signal(false);

  constructor() {
    // TODO(coachmark cleanup): remove this effect() with the rest of the guided tour. The step 1
    // popover sits behind a backdrop that blocks clicks into the page, so the domains input can't
    // be focused by clicking it while the popover is open. Focus it directly instead.
    effect(() => {
      if (this.tourStep() !== 1) {
        return;
      }
      afterNextRender(() => this.domainsInput()?.nativeElement.focus(), {
        injector: this.injector,
      });
    });

    this.inviteLink$.pipe(takeUntilDestroyed()).subscribe((inviteLink) => {
      if (inviteLink && !this.form.dirty) {
        this.prefillAttempted.set(true);
        this.form.controls.domains.setValue(inviteLink.allowedDomains.join(", "));
      } else if (inviteLink == null && !this.form.dirty && !this.prefillAttempted()) {
        this.prefillAttempted.set(true);
        void this.prefillFromVerifiedDomains();
      }

      if (inviteLink) {
        // `emitEvent: false` — this reflects what the server already has, so it must not be
        // mistaken for a user flipping the switch and pushed back up.
        this.requireAdminConfirmation.setValue(!inviteLink.supportsConfirmation, {
          emitEvent: false,
        });
      }

      if (this.showCoachMarks() && inviteLink == null && !this.tourStarted()) {
        this.tourStarted.set(true);
        // HACK: wait until the dialog has settled, otherwise the popover can anchor to a stale rect and render out of place.
        setTimeout(() => this.tourStep.set(1), 250);
      }
    });

    this.requireAdminConfirmation.valueChanges
      .pipe(
        concatMap((requireAdminConfirmation) =>
          this.saveInviteConfirmation(requireAdminConfirmation),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Pushes the flipped switch to the server. On failure the switch is rolled back so it keeps
   * showing the setting that is actually in effect.
   */
  private async saveInviteConfirmation(requireAdminConfirmation: boolean): Promise<void> {
    const userId = await firstValueFrom(this.userId$);

    this.requireAdminConfirmation.disable({ emitEvent: false });
    try {
      await this.inviteLinkService.setInviteConfirmation(
        userId,
        this.organizationId(),
        !requireAdminConfirmation,
      );

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("inviteLinkConfirmationUpdated"),
      });
    } catch (e) {
      this.requireAdminConfirmation.setValue(!requireAdminConfirmation, { emitEvent: false });
      this.validationService.showError(e);
    } finally {
      this.requireAdminConfirmation.enable({ emitEvent: false });
    }
  }

  private async prefillFromVerifiedDomains(): Promise<void> {
    let verifiedDomainNames: string[];
    try {
      // Goes through the SDK rather than the full domains endpoint, which requires Manage SSO:
      // calling that without the permission returns a 401 that the api service treats as an
      // invalid access token, logging the user out of the vault entirely.
      const userId = await firstValueFrom(this.userId$);
      verifiedDomainNames = await this.organizationDomainsService.verifiedDomains(
        userId,
        this.organizationId(),
      );
    } catch (e) {
      // Prefilling is a convenience, so a failure here should leave the field empty rather than
      // surface an error. Servers older than this endpoint answer with a 404.
      this.logService.error("Failed to prefill invite link domains from org domains.", e);
      return;
    }

    if (verifiedDomainNames.length > 0) {
      this.form.controls.domains.setValue(verifiedDomainNames.join(", "));
      this.form.controls.domains.markAsDirty();
    }
  }

  readonly save = async () => {
    this.form.markAllAsTouched();
    // NOTE: this parses domains (not just `Validators.required` on the raw string) so that
    // comma/whitespace-only input (e.g. ",  ,") is treated as empty here, rather than reaching
    // the service layer and throwing "At least one allowed domain is required." This check
    // should stay even after the guided tour is removed.
    const domains = parseDomains(this.form.value.domains);
    if (this.form.invalid || domains.length === 0) {
      // TODO(coachmark cleanup): the focus() call below can be removed once the guided tour
      // (and its backdrop, which blocks clicks into the page) is gone — see domainsInput above.
      this.domainsInput()?.nativeElement.focus();
      return;
    }

    const userId = await firstValueFrom(this.userId$);
    const inviteLink = await firstValueFrom(this.inviteLink$);

    try {
      if (inviteLink) {
        // Save only ever edits the domains once a link exists; the switch saves itself.
        await this.inviteLinkService.updateAllowedDomains(userId, this.organizationId(), domains);
      } else {
        // The switch is hidden until a link exists, so a new link always starts on the
        // link-confirm flow — that is the behaviour we want admins defaulted into.
        await this.inviteLinkService.createInviteLink(
          userId,
          this.organizationId(),
          domains,
          this.autoConfirmEnabled(),
        );
      }
    } catch (e) {
      // The server can still reject domains that passed client-side parsing (e.g. malformed or
      // duplicate domains), so refocus here too rather than only on the local validation path.
      // TODO(coachmark cleanup): this focus() call exists for the same backdrop-blocks-clicks
      // reason as the one above — remove both together with the guided tour.
      this.domainsInput()?.nativeElement.focus();
      throw e;
    }

    this.form.markAsPristine();

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("domainsEdited"),
    });
  };

  readonly saveAndAdvanceToStep2 = async () => {
    if (this.form.dirty || (await firstValueFrom(this.inviteLink$)) == null) {
      await this.save();
      if (this.form.invalid || this.domainsEmpty()) {
        return;
      }
    }
    this.tourStep.set(2);
  };

  readonly copyLink = async () => {
    const url = await firstValueFrom(this.inviteLinkUrl$);
    if (url == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(url);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkCopied"),
    });

    await this.eventCollectionService.collect(
      EventType.Organization_InviteLinkClientCopied,
      undefined,
      false,
      this.organizationId(),
    );
  };

  readonly refreshLink = async () => {
    const userId = await firstValueFrom(this.userId$);
    // Regenerating replaces the code and secret but carries the confirmation setting over.
    await this.inviteLinkService.refreshInviteLink(
      userId,
      this.organizationId(),
      this.autoConfirmEnabled() && !this.requireAdminConfirmation.value,
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkRegenerated"),
    });
  };

  readonly deactivateLink = async () => {
    const userId = await firstValueFrom(this.userId$);
    await this.inviteLinkService.delete(userId, this.organizationId());
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("inviteLinkInvalidated"),
    });
  };
}
