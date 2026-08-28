import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { combineLatest, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  AccordionComponent,
  BitwardenIcon,
  ButtonModule,
  CheckboxModule,
  FormControlModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  SectionComponent,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { ShareLinkService } from "../../services/share-link.service";
import type { ShareLink } from "../../services/share-link.service";
import { ExpiryChoice, ExpiryOption } from "../../types/share-link.types";

@Component({
  selector: "app-share-item-form",
  templateUrl: "share-item-form.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AccordionComponent,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    SectionComponent,
    SelectModule,
    CheckboxModule,
    FormControlModule,
    IconModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class ShareItemFormComponent implements OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly shareLinkService = inject(ShareLinkService);
  private readonly sendPolicyService = inject(SendPolicyService);
  private readonly logService = inject(LogService);

  /** The cipher to share. Provided by the shell component. */
  readonly cipher = input.required<CipherView>();

  protected readonly activeLinks = signal<ShareLink[]>([]);
  protected readonly collections = signal<CollectionView[]>([]);
  protected readonly folder = signal<FolderView | null>(null);

  protected readonly cipherTypeIcon = computed<BitwardenIcon>(() => {
    const currentCipher = this.cipher();
    switch (currentCipher?.type) {
      case CipherType.Login:
        return "bwi-globe";
      case CipherType.Card:
        return "bwi-credit-card";
      case CipherType.Identity:
        return "bwi-id-card";
      case CipherType.SecureNote:
        return "bwi-sticky-note";
      case CipherType.SshKey:
        return "bwi-key";
      case CipherType.BankAccount:
        return "bwi-bank";
      case CipherType.DriversLicense:
        return "bwi-id-card";
      case CipherType.Passport:
        return "bwi-passport";
      default:
        return "bwi-globe";
    }
  });

  protected cipherSubtitle(): string | undefined {
    return CipherViewLikeUtils.subtitle(this.cipher(), this.i18nService);
  }

  protected readonly expiryOptions: ExpiryChoice[] = [
    { label: this.i18nService.t("expiryOneHour"), value: ExpiryOption.OneHour },
    { label: this.i18nService.t("expiryOneDay"), value: ExpiryOption.OneDay },
    { label: this.i18nService.t("expiryTwoDays"), value: ExpiryOption.TwoDays },
    { label: this.i18nService.t("expiryThreeDays"), value: ExpiryOption.ThreeDays },
    { label: this.i18nService.t("expirySevenDays"), value: ExpiryOption.SevenDays },
    { label: this.i18nService.t("expiryFourteenDays"), value: ExpiryOption.FourteenDays },
    { label: this.i18nService.t("expiryThirtyDays"), value: ExpiryOption.ThirtyDays },
  ];

  private readonly emailListValidator: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    const emails = control.value.split(",").map((e: string) => e.trim());
    const nonEmptyEmails = emails.filter((e: string) => e.length > 0);
    if (nonEmptyEmails.length === 0) {
      return { required: true };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = nonEmptyEmails.filter((e: string) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return { multipleEmails: true };
    }

    const policyAllowedDomains = this.policyAllowedDomains();
    if (policyAllowedDomains && policyAllowedDomains.length > 0) {
      const disallowedEmails = nonEmptyEmails.filter((email: string) => {
        const domain = email.split("@")[1]?.toLowerCase();
        return !policyAllowedDomains.includes(domain);
      });
      if (disallowedEmails.length > 0) {
        return {
          domainNotAllowed: {
            value: control.value,
            domains: policyAllowedDomains.join(", "),
            message: this.i18nService.t("domainNotAllowed", policyAllowedDomains.join(", ")),
          },
        };
      }
    }

    return null;
  };

  private readonly emailsMaxLengthValidator: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    if (typeof control.value !== "string" || control.value.length < 2500) {
      return null;
    }
    return {
      emailsMaxLength: {
        message: this.i18nService.t("sendEmailsCharacterLimitReached"),
      },
    };
  };

  readonly form = new FormGroup({
    emails: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, this.emailListValidator, this.emailsMaxLengthValidator],
    }),
    expiryHours: new FormControl<ExpiryOption>(ExpiryOption.SevenDays, {
      nonNullable: true,
    }),
    oneTimeShare: new FormControl(false, { nonNullable: true }),
  });

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  private readonly policyAllowedDomains = signal<string[] | null>(null);

  constructor() {
    this.sendPolicyService.deletionDatePolicyInfo$.pipe(takeUntilDestroyed()).subscribe((dh) => {
      if (dh?.deletionHours) {
        const expiryHoursFormControl = this.form.get("expiryHours");
        expiryHoursFormControl?.setValue(dh.deletionHours as any);
        expiryHoursFormControl?.disable();
      }
    });

    this.sendPolicyService.allowedDomains$
      .pipe(takeUntilDestroyed())
      .subscribe((allowedDomains) => {
        const emailsControl = this.form.get("emails");
        if (allowedDomains && allowedDomains.length > 0) {
          this.policyAllowedDomains.set(allowedDomains);
        } else {
          this.policyAllowedDomains.set(null);
        }
        emailsControl?.updateValueAndValidity();
      });
    const cipher$ = toObservable(this.cipher).pipe(filterOutNullish());

    combineLatest([
      cipher$,
      this.activeUserId$.pipe(
        switchMap((userId) => this.collectionService.decryptedCollections$(userId)),
      ),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([cipher, allCollections]) => {
        this.collections.set(
          cipher.collectionIds?.length
            ? allCollections.filter((c) => cipher.collectionIds.includes(c.id))
            : [],
        );
      });

    combineLatest([
      cipher$,
      this.activeUserId$.pipe(switchMap((userId) => this.folderService.folderViews$(userId))),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([cipher, allFolders]) => {
        this.folder.set(
          cipher.folderId ? (allFolders.find((f) => f.id === cipher.folderId) ?? null) : null,
        );
      });

    cipher$.pipe(takeUntilDestroyed()).subscribe((cipher) => {
      void this.shareLinkService.setCipher(cipher.id as CipherId);
    });

    this.shareLinkService.links$.pipe(takeUntilDestroyed()).subscribe((links) => {
      this.activeLinks.set(links);
    });
  }

  ngOnDestroy(): void {
    void this.shareLinkService.setCipher(undefined);
  }

  protected async copyLink(link: ShareLink): Promise<void> {
    this.platformUtilsService.copyToClipboard(link.url);
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("linkCopiedToClipboard"),
    });
  }

  protected async deleteLink(link: ShareLink): Promise<void> {
    try {
      await this.shareLinkService.deleteLink(link.sendId);
      this.toastService.showToast({
        variant: "success",
        title: undefined,
        message: this.i18nService.t("shareLinkDeleted"),
      });
    } catch (err) {
      this.logService.error(err);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("shareLinkDeleteFailed"),
      });
    }
  }

  async createAndCopyLink(): Promise<boolean> {
    if (this.form.invalid) {
      return false;
    }

    const currentCipher = this.cipher();
    if (!currentCipher) {
      return false;
    }

    const formValue = this.form.getRawValue();
    const emails = formValue.emails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    try {
      const link = await this.shareLinkService.createShareLink(
        currentCipher,
        emails,
        formValue.expiryHours,
        formValue.oneTimeShare,
      );

      if (link) {
        this.platformUtilsService.copyToClipboard(link);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("linkSavedAndCopied"),
        });
        this.form.controls.emails.reset();
        return true;
      } else {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("linkSavedCopyFailed"),
        });
        return false;
      }
    } catch (err) {
      this.logService.error(err);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("linkSaveFailed"),
      });
      return false;
    }
  }

  protected linkEmailDisplay(emails: string[]): string {
    if (emails.length <= 1) {
      return emails[0] ?? "";
    }
    return `${emails[0]}, +${emails.length - 1}`;
  }
}
