import { CommonModule, Location } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, switchMap } from "rxjs";


import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  AccordionComponent,
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SelectModule,
  CheckboxModule,
  FormControlModule,
  IconModule,
  ToastService,
  TypographyModule,
  BitwardenIcon,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { ShareLink, ShareLinkService } from "./share-link.service";

const ExpiryOption = Object.freeze({
  OneHour: 1,
  OneDay: 24,
  TwoDays: 48,
  ThreeDays: 72,
  SevenDays: 168,
  FourteenDays: 336,
  ThirtyDays: 720,
} as const);

type ExpiryOption = (typeof ExpiryOption)[keyof typeof ExpiryOption];

interface ExpiryChoice {
  label: string;
  value: ExpiryOption;
}

@Component({
  selector: "app-share-item",
  templateUrl: "share-item.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    AccordionComponent,
    ButtonModule,
    CardComponent,
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
export class ShareItemComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);
  private readonly collectionService = inject(CollectionService);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly shareLinkService = inject(ShareLinkService);

  protected readonly cipher = signal<CipherView | null>(null);
  protected readonly activeLinks = signal<ShareLink[]>([]);
  protected readonly accordionExpanded = signal(false);
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
      default:
        return "bwi-globe";
    }
  });

  protected readonly cipherSubtitle = computed<string | undefined>(() => {
    const c = this.cipher();
    if (!c) {
      return undefined;
    }
    switch (c.type) {
      case CipherType.Login:
        return c.login?.username || undefined;
      case CipherType.Card:
        return c.card?.cardholderName || undefined;
      case CipherType.Identity:
        return [c.identity?.firstName, c.identity?.lastName].filter(Boolean).join(" ") || undefined;
      default:
        return undefined;
    }
  });

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
    const emails = (control.value as string).split(",").map((e) => e.trim());
    const nonEmpty = emails.filter((e) => e.length > 0);
    if (nonEmpty.length === 0) {
      return { required: true };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = nonEmpty.filter((e) => !emailRegex.test(e));
    if (invalid.length > 0) {
      return { multipleEmails: true };
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

  protected readonly form = new FormGroup({
    emails: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, this.emailListValidator, this.emailsMaxLengthValidator],
    }),
    expiryHours: new FormControl<ExpiryOption>(ExpiryOption.SevenDays, {
      nonNullable: true,
    }),
    oneTimeShare: new FormControl(false, { nonNullable: true }),
  });

  protected readonly CipherType = CipherType;

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);
  protected readonly activeUserId = toSignal(this.activeUserId$);

  constructor() {
    this.route.queryParams
      .pipe(
        takeUntilDestroyed(),
        switchMap((params) => {
          const cipherId = params.cipherId as CipherId;
          return this.activeUserId$.pipe(
            switchMap((userId) => this.cipherService.cipherView$(userId, cipherId)),
          );
        }),
      )
      .subscribe((cipherView) => {
        if (cipherView) {
          this.cipher.set(cipherView);
          this.refreshActiveLinks(cipherView.id as CipherId);
        }
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

    this.shareLinkService.links$.pipe(takeUntilDestroyed()).subscribe(() => {
      const currentCipher = this.cipher();
      if (currentCipher) {
        this.refreshActiveLinks(currentCipher.id as CipherId);
      }
    });
  }

  protected getCipherTypeName(): string {
    const currentCipher = this.cipher();
    if (!currentCipher) {
      return "";
    }
    switch (currentCipher.type) {
      case CipherType.Login:
        return this.i18nService.t("typeLogin");
      case CipherType.Card:
        return this.i18nService.t("typeCard");
      case CipherType.Identity:
        return this.i18nService.t("typeIdentity");
      case CipherType.SecureNote:
        return this.i18nService.t("typeSecureNote");
      default:
        return "";
    }
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
    await this.shareLinkService.deleteLink(link.id);
    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("shareLinkDeleted"),
    });
  }

  protected async createAndCopyLink(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const currentCipher = this.cipher();
    if (!currentCipher) {
      return;
    }

    const formValue = this.form.getRawValue();
    const emails = formValue.emails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const link = await this.shareLinkService.createShareLink(
      currentCipher.id as CipherId,
      emails,
      formValue.expiryHours,
      formValue.oneTimeShare,
    );

    this.platformUtilsService.copyToClipboard(link.url);

    this.toastService.showToast({
      variant: "success",
      title: undefined,
      message: this.i18nService.t("linkSavedAndCopied"),
    });

    this.form.controls.emails.reset();
  }

  protected linkEmailDisplay(emails: string[]): string {
    if (emails.length <= 1) {
      return emails[0] ?? "";
    }
    return `${emails[0]}, +${emails.length - 1}`;
  }

  protected onBackClick(): void {
    this.location.back();
  }

  private refreshActiveLinks(cipherId: CipherId): void {
    this.activeLinks.set(this.shareLinkService.getLinksForCipher(cipherId));
  }
}
