// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import {
  Subject,
  firstValueFrom,
  takeUntil,
  map,
  BehaviorSubject,
  concatMap,
  switchMap,
  tap,
} from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";
import { SendTextView } from "@bitwarden/common/tools/send/models/view/send-text.view";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService, ToastService } from "@bitwarden/components";

// Value = hours
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
enum DatePreset {
  OneHour = 1,
  OneDay = 24,
  TwoDays = 48,
  ThreeDays = 72,
  SevenDays = 168,
  ThirtyDays = 720,
  Custom = 0,
  Never = null,
}

interface DatePresetSelectOption {
  name: string;
  value: DatePreset;
}

@Directive()
export class AddEditComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() sendId: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() type: SendType;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSavedSend = new EventEmitter<SendView>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onDeletedSend = new EventEmitter<SendView>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onCancelled = new EventEmitter<SendView>();

  deletionDatePresets: DatePresetSelectOption[] = [
    { name: this.i18nService.t("oneHour"), value: DatePreset.OneHour },
    { name: this.i18nService.t("oneDay"), value: DatePreset.OneDay },
    { name: this.i18nService.t("days", "2"), value: DatePreset.TwoDays },
    { name: this.i18nService.t("days", "3"), value: DatePreset.ThreeDays },
    { name: this.i18nService.t("days", "7"), value: DatePreset.SevenDays },
    { name: this.i18nService.t("days", "30"), value: DatePreset.ThirtyDays },
    { name: this.i18nService.t("custom"), value: DatePreset.Custom },
  ];

  expirationDatePresets: DatePresetSelectOption[] = [
    { name: this.i18nService.t("never"), value: DatePreset.Never },
    ...this.deletionDatePresets,
  ];

  copyLink = false;
  disableSend = false;
  disableHideEmail = false;
  send: SendView;
  hasPassword: boolean;
  showPassword = false;
  formPromise: Promise<any>;
  deletePromise: Promise<any>;
  sendType = SendType;
  typeOptions: any[];
  canAccessPremium = true;
  emailVerified = true;
  alertShown = false;
  showOptions = false;

  protected componentName = "";
  private sendLinkBaseUrl: string;
  private destroy$ = new Subject<void>();

  protected formGroup = this.formBuilder.group({
    name: ["", Validators.required],
    text: [],
    textHidden: [false],
    fileContents: [],
    file: [null, Validators.required],
    link: [],
    copyLink: false,
    maxAccessCount: [],
    accessCount: [],
    password: [],
    notes: [],
    hideEmail: false,
    disabled: false,
    type: [],
    defaultExpirationDateTime: [],
    defaultDeletionDateTime: ["", Validators.required],
    selectedDeletionDatePreset: [DatePreset.SevenDays, Validators.required],
    selectedExpirationDatePreset: [],
  });

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected environmentService: EnvironmentService,
    protected datePipe: DatePipe,
    protected sendService: SendService,
    protected messagingService: MessagingService,
    protected policyService: PolicyService,
    protected logService: LogService,
    protected stateService: StateService,
    protected sendApiService: SendApiService,
    protected dialogService: DialogService,
    protected formBuilder: FormBuilder,
    protected billingAccountProfileStateService: BillingAccountProfileStateService,
    protected accountService: AccountService,
    protected toastService: ToastService,
    protected premiumUpgradePromptService: PremiumUpgradePromptService,
  ) {
    this.typeOptions = [
      { name: i18nService.t("sendTypeFile"), value: SendType.File, premium: true },
      { name: i18nService.t("sendTypeText"), value: SendType.Text, premium: false },
    ];
  }

  get link(): string {
    if (this.send != null && this.send.id != null && this.send.accessId != null) {
      return this.sendLinkBaseUrl + this.send.accessId + "/" + this.send.urlB64Key;
    }
    return null;
  }

  async ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        this.disableSend = policyAppliesToActiveUser;
        if (this.disableSend) {
          this.formGroup.disable();
        }
      });

    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.policyService.policiesByType$(PolicyType.SendOptions, userId)),
        map((policies) => policies?.some((p) => p.data.disableHideEmail)),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToActiveUser) => {
        if (
          (this.disableHideEmail = policyAppliesToActiveUser) &&
          !this.formGroup.controls.hideEmail.value
        ) {
          this.formGroup.controls.hideEmail.disable();
        } else {
          this.formGroup.controls.hideEmail.enable();
        }
      });

    this.formGroup.controls.type.valueChanges
      .pipe(
        tap((val) => {
          this.type = val;
        }),
        switchMap(() => this.typeChanged()),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.formGroup.controls.selectedDeletionDatePreset.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((datePreset) => {
        datePreset === DatePreset.Custom
          ? this.formGroup.controls.defaultDeletionDateTime.enable()
          : this.formGroup.controls.defaultDeletionDateTime.disable();
      });

    this.formGroup.controls.hideEmail.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val) => {
        if (!val && this.disableHideEmail && this.formGroup.controls.hideEmail.enabled) {
          this.formGroup.controls.hideEmail.disable();
        }
      });

    const env = await firstValueFrom(this.environmentService.environment$);
    this.sendLinkBaseUrl = env.getSendUrl();

    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((hasPremiumFromAnySource) => {
        this.canAccessPremium = hasPremiumFromAnySource;
      });

    await this.load();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get editMode(): boolean {
    return this.sendId != null;
  }

  get title(): string {
    return this.i18nService.t(this.editMode ? "editSend" : "createSend");
  }

  async load() {
    this.emailVerified = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.emailVerified ?? false)),
    );

    this.type = !this.canAccessPremium || !this.emailVerified ? SendType.Text : SendType.File;
    if (this.send == null) {
      const send = new BehaviorSubject<SendView>(this.send);
      send.subscribe({
        next: (decryptedSend: SendView | undefined) => {
          if (!(decryptedSend instanceof SendView)) {
            return;
          }

          this.send = decryptedSend;
          decryptedSend.type = decryptedSend.type ?? this.type;
          this.type = this.send.type;
          this.updateFormValues();
          this.hasPassword = this.send.password != null && this.send.password.trim() !== "";
        },
        error: (error: unknown) => {
          const errorMessage = (error as Error).message ?? "An unknown error occurred";
          this.logService.error("Failed to decrypt send: " + errorMessage);
        },
      });

      if (this.editMode) {
        this.accountService.activeAccount$
          .pipe(
            getUserId,
            switchMap((userId) =>
              this.sendService
                .get$(this.sendId)
                .pipe(
                  concatMap((s) =>
                    s instanceof Send
                      ? s.decrypt(userId)
                      : Promise.reject(new Error("Failed to load send.")),
                  ),
                ),
            ),
            takeUntil(this.destroy$),
          )
          .subscribe(send);
      } else {
        const sendView = new SendView();
        sendView.type = this.type;
        sendView.file = new SendFileView();
        sendView.text = new SendTextView();
        sendView.deletionDate = new Date();
        sendView.deletionDate.setDate(sendView.deletionDate.getDate() + 7);
        send.next(sendView);
      }
    }
  }

  async submit(): Promise<boolean> {
    this.formGroup.markAllAsTouched();

    if (this.disableSend) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("sendDisabledWarning"),
      });
      return false;
    }

    this.send.name = this.formGroup.controls.name.value;
    this.send.text.text = this.formGroup.controls.text.value;
    this.send.text.hidden = this.formGroup.controls.textHidden.value;
    this.send.maxAccessCount = this.formGroup.controls.maxAccessCount.value;
    this.send.accessCount = this.formGroup.controls.accessCount.value;
    this.send.password = this.formGroup.controls.password.value;
    this.send.notes = this.formGroup.controls.notes.value;
    this.send.hideEmail = this.formGroup.controls.hideEmail.value;
    this.send.disabled = this.formGroup.controls.disabled.value;
    this.send.type = this.type;

    if (Utils.isNullOrWhitespace(this.send.name)) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nameRequired"),
      });
      return false;
    }

    let file: File = null;
    if (this.type === SendType.File && !this.editMode) {
      const fileEl = document.getElementById("file") as HTMLInputElement;
      const files = fileEl.files;
      if (files == null || files.length === 0) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("selectFile"),
        });
        return;
      }

      file = files[0];
      if (files[0].size > 524288000) {
        // 500 MB
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("maxFileSize"),
        });
        return;
      }
    }

    if (Utils.isNullOrWhitespace(this.send.password)) {
      this.send.password = null;
    }

    this.formPromise = this.encryptSend(file).then(async (encSend) => {
      const uploadPromise = this.sendApiService.save(encSend);
      await uploadPromise;
      if (this.send.id == null) {
        this.send.id = encSend[0].id;
      }
      if (this.send.accessId == null) {
        this.send.accessId = encSend[0].accessId;
      }
      this.onSavedSend.emit(this.send);
      if (this.formGroup.controls.copyLink.value && this.link != null) {
        await this.handleCopyLinkToClipboard();
        return;
      }
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(this.editMode ? "editedSend" : "createdSend"),
      });
    });
    try {
      await this.formPromise;
      return true;
    } catch (e) {
      this.logService.error(e);
    }
    return false;
  }

  async copyLinkToClipboard(link: string): Promise<void | boolean> {
    return Promise.resolve(this.platformUtilsService.copyToClipboard(link));
  }

  protected async delete(): Promise<boolean> {
    if (this.deletePromise != null) {
      return false;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.deletePromise = this.sendApiService.delete(this.send.id);
      await this.deletePromise;
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedSend"),
      });
      await this.load();
      this.onDeletedSend.emit(this.send);
      return true;
    } catch (e) {
      this.logService.error(e);
    }

    return false;
  }

  async typeChanged() {
    if (this.type === SendType.File && !this.alertShown) {
      if (!this.canAccessPremium) {
        this.alertShown = true;
        await this.premiumUpgradePromptService.promptForPremium();
      } else if (!this.emailVerified) {
        this.alertShown = true;
        this.messagingService.send("emailVerificationRequired");
      }
    }
    this.type === SendType.Text || this.editMode
      ? this.formGroup.controls.file.disable()
      : this.formGroup.controls.file.enable();
  }

  toggleOptions() {
    this.showOptions = !this.showOptions;
  }

  protected loadSend(): Promise<Send> {
    return firstValueFrom(this.sendService.get$(this.sendId));
  }

  protected async encryptSend(file: File): Promise<[Send, EncArrayBuffer]> {
    const sendData = await this.sendService.encrypt(this.send, file, this.send.password, null);

    // Parse dates
    try {
      sendData[0].deletionDate =
        this.formattedDeletionDate == null ? null : new Date(this.formattedDeletionDate);
    } catch {
      sendData[0].deletionDate = null;
    }
    try {
      sendData[0].expirationDate =
        this.formattedExpirationDate == null ? null : new Date(this.formattedExpirationDate);
    } catch {
      sendData[0].expirationDate = null;
    }

    return sendData;
  }

  protected togglePasswordVisible() {
    this.showPassword = !this.showPassword;
    document.getElementById("password").focus();
  }

  updateFormValues() {
    this.formGroup.patchValue({
      name: this.send?.name ?? "",
      text: this.send?.text?.text ?? "",
      textHidden: this.send?.text?.hidden ?? false,
      link: this.link ?? "",
      maxAccessCount: this.send?.maxAccessCount,
      accessCount: this.send?.accessCount ?? 0,
      notes: this.send?.notes ?? "",
      hideEmail: this.send?.hideEmail ?? false,
      disabled: this.send?.disabled ?? false,
      type: this.send.type ?? this.type,
      password: null,

      selectedDeletionDatePreset: this.editMode ? DatePreset.Custom : DatePreset.SevenDays,
      selectedExpirationDatePreset: this.editMode ? DatePreset.Custom : DatePreset.Never,
      defaultExpirationDateTime:
        this.send.expirationDate != null
          ? this.datePipe.transform(new Date(this.send.expirationDate), "yyyy-MM-ddTHH:mm")
          : null,
      defaultDeletionDateTime: this.datePipe.transform(
        new Date(this.send.deletionDate),
        "yyyy-MM-ddTHH:mm",
      ),
    });

    if (this.send.hideEmail) {
      this.formGroup.controls.hideEmail.enable();
    }
  }

  private async handleCopyLinkToClipboard() {
    const copySuccess = await this.copyLinkToClipboard(this.link);
    if (copySuccess ?? true) {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(this.editMode ? "editedSend" : "createdSend"),
      });
    } else {
      await this.dialogService.openSimpleDialog({
        title: "",
        content: { key: this.editMode ? "editedSend" : "createdSend" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "success",
      });

      await this.copyLinkToClipboard(this.link);
    }
  }

  clearExpiration() {
    this.formGroup.controls.defaultExpirationDateTime.patchValue(null);
  }

  get formattedExpirationDate(): string {
    switch (this.formGroup.controls.selectedExpirationDatePreset.value as DatePreset) {
      case DatePreset.Never:
        return null;
      case DatePreset.Custom:
        if (!this.formGroup.controls.defaultExpirationDateTime.value) {
          return null;
        }
        return this.formGroup.controls.defaultExpirationDateTime.value;
      default: {
        const now = new Date();
        const milliseconds = now.setTime(
          now.getTime() +
            (this.formGroup.controls.selectedExpirationDatePreset.value as number) * 60 * 60 * 1000,
        );
        return new Date(milliseconds).toString();
      }
    }
  }

  get formattedDeletionDate(): string {
    switch (this.formGroup.controls.selectedDeletionDatePreset.value as DatePreset) {
      case DatePreset.Never:
        this.formGroup.controls.selectedDeletionDatePreset.patchValue(DatePreset.SevenDays);
        return this.formattedDeletionDate;
      case DatePreset.Custom:
        return this.formGroup.controls.defaultDeletionDateTime.value;
      default: {
        const now = new Date();
        const milliseconds = now.setTime(
          now.getTime() +
            (this.formGroup.controls.selectedDeletionDatePreset.value as number) * 60 * 60 * 1000,
        );
        return new Date(milliseconds).toString();
      }
    }
  }
}
