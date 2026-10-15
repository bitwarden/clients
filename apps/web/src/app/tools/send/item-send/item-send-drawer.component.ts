import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { combineLatest, firstValueFrom, map, merge, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  asDatePreset,
  SendDeletionDatePreset,
} from "@bitwarden/common/tools/models/send-deletion-date-preset";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  AccordionComponent,
  AsyncActionsModule,
  BadgeModule,
  BitwardenIcon,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormControlModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  Option,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { SendPolicyService } from "@bitwarden/send-ui";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";
import { CipherViewComponent, VaultViewPasswordHistoryService } from "@bitwarden/vault";

export interface ItemSendDrawerParams {
  /** The item-type Send to view and edit. */
  send: SendView;
}

/** A result of the item Send drawer. */
export const ItemSendDrawerResult = Object.freeze({
  /** The Send was updated. */
  Updated: "updated",
  /** The Send was deleted. */
  Deleted: "deleted",
} as const);

/** A result of the item Send drawer. */
export type ItemSendDrawerResult = (typeof ItemSendDrawerResult)[keyof typeof ItemSendDrawerResult];

/** A preset (hours from now) or an existing date, as a string. */
type DateSelection = SendDeletionDatePreset | string;

/**
 * Drawer for viewing and editing an item-type Send from the Send tab. The shared item content is
 * always read-only; only the link expiry, deletion date, and one-time share option can be edited.
 * Also lists the other active share links for the same item.
 */
@Component({
  templateUrl: "item-send-drawer.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    AccordionComponent,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    CardComponent,
    CheckboxModule,
    CipherViewComponent,
    DialogModule,
    FormControlModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    TypographyModule,
    I18nPipe,
  ],
  providers: [
    DatePipe,
    // This is required to make the CipherViewComponent work
    safeProvider({
      provide: ViewPasswordHistoryService,
      useClass: VaultViewPasswordHistoryService,
      deps: [DialogService],
    }),
  ],
})
export class ItemSendDrawerComponent {
  private readonly params = inject<ItemSendDrawerParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<ItemSendDrawerResult>>(DialogRef);
  private readonly accountService = inject(AccountService);
  private readonly datePipe = inject(DatePipe);
  private readonly dialogService = inject(DialogService);
  private readonly environmentService = inject(EnvironmentService);
  private readonly folderService = inject(FolderService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly organizationService = inject(OrganizationService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly sendApiService = inject(SendApiService);
  private readonly sendPolicyService = inject(SendPolicyService);
  private readonly sendService = inject(SendService);
  private readonly toastService = inject(ToastService);

  /** The Send being viewed. Replaced after a successful edit or when another link is edited. */
  protected readonly send = signal<SendView>(this.params.send);
  protected readonly cipher = computed(() => this.send().data?.data);

  /** Whether the advanced options are being edited. */
  protected readonly editing = signal(false);

  protected readonly cipherTypeIcon = computed<BitwardenIcon>(() => {
    switch (this.cipher()?.type) {
      case CipherType.Card:
        return "bwi-credit-card";
      case CipherType.Identity:
      case CipherType.DriversLicense:
        return "bwi-id-card";
      case CipherType.SecureNote:
        return "bwi-sticky-note";
      case CipherType.SshKey:
        return "bwi-key";
      case CipherType.BankAccount:
        return "bwi-bank";
      case CipherType.Passport:
        return "bwi-passport";
      default:
        return "bwi-globe";
    }
  });

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  /** The organization name for organization items, or "My vault" for personal items. */
  protected readonly ownerName = signal<string>(this.i18nService.t("myVault"));
  protected readonly folderName = signal<string | undefined>(undefined);
  protected readonly policyDeletionHoursOrgName = signal<string | undefined>(undefined);

  protected readonly expiryOptions = signal<Option<DateSelection>[]>([]);
  protected readonly deletionDateOptions = signal<Option<DateSelection>[]>([]);

  readonly form = new FormGroup({
    expiry: new FormControl<DateSelection>(SendDeletionDatePreset.SevenDays, {
      nonNullable: true,
    }),
    deletionDate: new FormControl<DateSelection>(SendDeletionDatePreset.SevenDays, {
      nonNullable: true,
    }),
    oneTimeShare: new FormControl(false, { nonNullable: true }),
  });

  /**
   * Share links for the same item that can still be opened, oldest deletion date first. The
   * Send being viewed is always included, even if it can no longer be opened.
   */
  protected readonly activeLinks = toSignal(
    combineLatest([this.sendService.sendViews$, toObservable(this.send)]).pipe(
      map(([sends, current]) => {
        const cipherId = current.data?.data?.id;
        if (!cipherId) {
          return [];
        }
        return sends
          .filter(
            (s) =>
              s.type === SendType.Item &&
              s.data?.data?.id === cipherId &&
              (s.id === current.id || (!s.expired && !s.maxAccessCountReached)),
          )
          .sort((a, b) => new Date(a.deletionDate).getTime() - new Date(b.deletionDate).getTime());
      }),
    ),
    { initialValue: [] },
  );

  constructor() {
    const cipher = this.cipher();

    if (cipher?.organizationId) {
      this.activeUserId$
        .pipe(
          switchMap((userId) => this.organizationService.organizations$(userId)),
          map((orgs) => orgs.find((o) => o.id === cipher.organizationId)?.name),
          takeUntilDestroyed(),
        )
        .subscribe((orgName) => {
          if (orgName) {
            this.ownerName.set(orgName);
          }
        });
    }

    this.activeUserId$
      .pipe(
        switchMap((userId) =>
          cipher?.folderId ? this.folderService.getDecrypted$(cipher.folderId, userId) : of(null),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((folder) => this.folderName.set(folder?.name));

    combineLatest([
      this.sendPolicyService.deletionDatePolicyInfo$,
      this.activeUserId$.pipe(
        switchMap((userId) => this.organizationService.organizations$(userId)),
      ),
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([policyInfo, organizations]) => {
        const deletionDateControl = this.form.controls.deletionDate;
        if (policyInfo?.deletionHours) {
          deletionDateControl.setValue(policyInfo.deletionHours);
          deletionDateControl.disable();
          this.policyDeletionHoursOrgName.set(
            organizations.find((o) => o.id === policyInfo.orgId)?.name,
          );
        } else {
          deletionDateControl.enable();
          this.policyDeletionHoursOrgName.set(undefined);
        }
      });

    // Clear the "expires after deletion date" error once either date changes
    merge(this.form.controls.expiry.valueChanges, this.form.controls.deletionDate.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.expiry.setErrors(null));
  }

  /** Time remaining until the link expires, e.g. "7 days". */
  protected readonly expiresAfter = computed(() => {
    const send = this.send();
    const expiry = send.expirationDate ?? send.deletionDate;
    if (!expiry) {
      return "";
    }
    const hoursAvailable = Math.max(
      0,
      Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60)),
    );
    if (hoursAvailable < 24) {
      return hoursAvailable === 1
        ? this.i18nService.t("oneHour")
        : this.i18nService.t("durationTimeHours", String(hoursAvailable));
    }
    const daysAvailable = Math.ceil(hoursAvailable / 24);
    return daysAvailable === 1
      ? this.i18nService.t("oneDay")
      : this.i18nService.t("days", String(daysAvailable));
  });

  protected readonly deletionDateDisplay = computed(
    () => this.datePipe.transform(this.send().deletionDate, "short") ?? "",
  );

  protected readonly emails = computed(() => this.send().emails?.join(", ") ?? "");

  protected readonly isOneTimeShare = computed(() => this.send().maxAccessCount === 1);

  protected linkEmailDisplay(emails: string[] | undefined): string {
    if (!emails?.length) {
      return "";
    }
    return emails.length === 1 ? emails[0] : `${emails[0]}, +${emails.length - 1}`;
  }

  protected linkExpiry(link: SendView): Date {
    return link.expirationDate ?? link.deletionDate;
  }

  protected readonly copyLink = async () => {
    await this.copyLinkFor(this.send());
  };

  protected async copyLinkFor(send: SendView) {
    const env = await firstValueFrom(this.environmentService.environment$);
    this.platformUtilsService.copyToClipboard(
      env.getSendUrl() + send.accessId + "/" + send.urlB64Key,
    );
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("linkCopiedToClipboard"),
    });
  }

  /** Switches the drawer to another link for the same item and starts editing it. */
  protected editLink(link: SendView) {
    this.send.set(link);
    this.edit();
  }

  protected edit() {
    const send = this.send();
    const expiry = send.expirationDate ?? send.deletionDate;
    // Keep the current dates as the defaults so saving without changes doesn't move them
    this.expiryOptions.set(this.dateOptions(expiry));
    this.deletionDateOptions.set(this.dateOptions(send.deletionDate));
    this.form.controls.expiry.setValue(expiry.toString());
    if (this.form.controls.deletionDate.enabled) {
      this.form.controls.deletionDate.setValue(send.deletionDate.toString());
    }
    this.form.controls.oneTimeShare.setValue(this.isOneTimeShare());
    this.form.controls.expiry.setErrors(null);
    this.editing.set(true);
  }

  protected cancelEdit() {
    this.editing.set(false);
  }

  protected readonly save = async () => {
    const { expiry, deletionDate, oneTimeShare } = this.form.getRawValue();
    const original = this.send();
    const expirationDate = this.resolveDate(
      expiry,
      original.expirationDate ?? original.deletionDate,
    );
    const newDeletionDate = this.resolveDate(deletionDate, original.deletionDate);

    if (expirationDate.getTime() > newDeletionDate.getTime()) {
      this.form.controls.expiry.setErrors({
        expiryAfterDeletionDate: {
          message: this.i18nService.t("linkExpiryAfterDeletionDate"),
        },
      });
      this.form.controls.expiry.markAsTouched();
      return;
    }

    const updated = Object.assign(new SendView(), original);
    updated.expirationDate = expirationDate;
    updated.deletionDate = newDeletionDate;
    updated.maxAccessCount = oneTimeShare ? 1 : undefined;

    try {
      await this.sendApiService.saveView(updated, null);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    this.send.set(updated);
    this.editing.set(false);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedSend"),
    });
  };

  protected readonly deleteSend = async () => {
    await this.deleteLink(this.send());
  };

  protected async deleteLink(link: SendView) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendPermanentConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    try {
      await this.sendApiService.delete(link.id);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedSend"),
    });
    if (link.id === this.send().id) {
      await this.dialogRef.close(ItemSendDrawerResult.Deleted);
    }
  }

  private dateOptions(current: Date): Option<DateSelection>[] {
    return [
      { label: this.datePipe.transform(current, "short") ?? "", value: current.toString() },
      { label: this.i18nService.t("oneHour"), value: SendDeletionDatePreset.OneHour },
      { label: this.i18nService.t("oneDay"), value: SendDeletionDatePreset.OneDay },
      { label: this.i18nService.t("days", "2"), value: SendDeletionDatePreset.TwoDays },
      { label: this.i18nService.t("days", "3"), value: SendDeletionDatePreset.ThreeDays },
      { label: this.i18nService.t("days", "7"), value: SendDeletionDatePreset.SevenDays },
      { label: this.i18nService.t("days", "14"), value: SendDeletionDatePreset.FourteenDays },
      { label: this.i18nService.t("days", "30"), value: SendDeletionDatePreset.ThirtyDays },
    ];
  }

  /** A preset becomes that many hours from now; anything else keeps the current date. */
  private resolveDate(selection: DateSelection, current: Date): Date {
    const preset = asDatePreset(selection);
    return preset != null ? new Date(Date.now() + preset * 60 * 60 * 1000) : new Date(current);
  }

  /**
   * Opens the item Send drawer.
   * @param dialogService Instance of the DialogService.
   * @param params The parameters for the drawer.
   * @returns The drawer reference.
   */
  static openDrawer(dialogService: DialogService, params: ItemSendDrawerParams) {
    return dialogService.openDrawer<
      ItemSendDrawerResult,
      ItemSendDrawerParams,
      ItemSendDrawerComponent
    >(ItemSendDrawerComponent, { data: params });
  }
}
