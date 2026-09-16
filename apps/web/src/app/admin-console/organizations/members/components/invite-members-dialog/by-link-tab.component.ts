import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, signal } from "@angular/core";
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

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
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

  private readonly accountService = inject(AccountService);
  private readonly inviteLinkService = inject(OrganizationInviteLinkService);
  private readonly orgDomainApiService = inject(OrgDomainApiServiceAbstraction);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly eventCollectionService = inject(EventCollectionService);
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
      map((v) => !v || v.trim().length === 0),
      startWith(true),
    ),
    { initialValue: true },
  );

  private readonly prefillAttempted = signal(false);
  private readonly tourStarted = signal(false);

  constructor() {
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
        this.tourStep.set(1);
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
    const allDomains = await this.orgDomainApiService.getAllByOrgId(this.organizationId());
    const verifiedDomainNames = allDomains
      .filter((d) => d.verifiedDate != null)
      .map((d) => d.domainName);

    if (verifiedDomainNames.length > 0) {
      this.form.controls.domains.setValue(verifiedDomainNames.join(", "));
      this.form.controls.domains.markAsDirty();
    }
  }

  readonly save = async () => {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const userId = await firstValueFrom(this.userId$);
    const rawDomains = this.form.value.domains;
    if (rawDomains == null) {
      throw new Error("Must provide at least one valid domain.");
    }

    const domains = rawDomains
      .split(",")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0);

    const inviteLink = await firstValueFrom(this.inviteLink$);

    if (inviteLink) {
      // Save only ever edits the domains once a link exists; the switch saves itself.
      await this.inviteLinkService.updateAllowedDomains(userId, this.organizationId(), domains);
    } else {
      // The switch is hidden until a link exists, so a new link always starts on the link-confirm
      // flow — that is the behaviour we want admins defaulted into.
      await this.inviteLinkService.createInviteLink(
        userId,
        this.organizationId(),
        domains,
        this.autoConfirmEnabled(),
      );
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
      if (this.form.invalid) {
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
