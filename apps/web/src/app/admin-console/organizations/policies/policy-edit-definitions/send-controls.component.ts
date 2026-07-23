import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  UntypedFormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { firstValueFrom, Observable } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { SavePolicyRequest } from "@bitwarden/common/admin-console/models/request/save-policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendControlsPolicyData } from "@bitwarden/common/tools/models/send-controls-policy-data";
import { SendDeletionDatePreset } from "@bitwarden/common/tools/models/send-deletion-date-preset";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { OrgKey } from "@bitwarden/common/types/key";
import {
  FormFieldModule,
  Option,
  SelectItemView,
  SelectModule,
  SwitchComponent,
  CheckboxModule,
  MultiSelectModule,
  RadioButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class SendControlsPolicy extends BasePolicyEditDefinition {
  name = "manageSend";
  description = "sendControlsPolicyDescV4";
  type = PolicyType.SendControls;
  category = PolicyCategory.DataControl;
  priority = 30;
  component = SendControlsPolicyComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.SendControls);
  }

  override enabled(policy: PolicyResponse): boolean {
    // This policy is always enabled, and is driven entirely through its `policy.data` configuration.
    // The 'enabled' UI reflects whether the Send feature is enabled, rather than whether the policy is enabled.

    // It is enabled by default:
    if (policy == null || policy.data == null) {
      return true;
    }

    // Or enabled if the Send feature is enabled:
    return !policy.data.disableSend;
  }
}

@Component({
  selector: "send-controls-policy-edit",
  templateUrl: "send-controls.component.html",
  imports: [
    FormsModule,
    ReactiveFormsModule,
    I18nPipe,
    CheckboxModule,
    FormFieldModule,
    MultiSelectModule,
    RadioButtonModule,
    SwitchComponent,
    SelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendControlsPolicyComponent extends BasePolicyEditComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly deletionHoursOptions: Option<SendDeletionDatePreset | null>[] = [];

  readonly data: FormGroup<ControlsOf<SendControlsPolicyData>> = this.formBuilder.group({
    disableSend: false,
    whoCanAccess: WhoCanAccessType.Any,
    allowedDomains: null,
    disableHideEmail: false,
    allowedSendTypes: [[SendType.Text, SendType.File], [Validators.required]],
    deletionHours: null,
  });
  readonly enableSendControl = new FormControl<boolean>(false);
  readonly allowedSendTypesMultiSelectControl = new FormControl<
    (SelectItemView & { value: SendType })[]
  >([], { validators: [Validators.required] });

  private readonly dataFormValue = toSignal(this.data.valueChanges);

  protected readonly sendFeatureAllowed = computed(() => !this.dataFormValue()?.disableSend);

  protected readonly allSendTypeOptions = signal<(SelectItemView & { value: SendType })[]>([
    {
      id: SendType.Text.toString(),
      icon: "bwi-file-text",
      listName: this.i18nService.t("sendTypeText"),
      labelName: this.i18nService.t("sendTypeText"),
      value: SendType.Text,
    },
    {
      id: SendType.File.toString(),
      icon: "bwi-file",
      listName: this.i18nService.t("sendTypeFile"),
      labelName: this.i18nService.t("sendTypeFile"),
      value: SendType.File,
    },
  ]).asReadonly();

  protected readonly sendAccessOptions: Option<WhoCanAccessType>[] = [
    { label: this.i18nService.t("any"), value: WhoCanAccessType.Any },
    { label: this.i18nService.t("emailVerification"), value: WhoCanAccessType.SpecificPeople },
    {
      label: this.i18nService.t("sendAccessOptionAnyoneWithAPassword"),
      value: WhoCanAccessType.PasswordProtected,
    },
  ];

  /** Whether the allowed domains text area should be displayed */
  readonly showDomains = signal(false);
  private readonly claimedDomains = signal<string | null>(null);
  protected readonly allowedDomainsHint = computed(() => {
    if (this.claimedDomains() != null) {
      return (
        this.i18nService.t("allowedDomainsAutopopulateAlert") +
        " " +
        this.i18nService.t("separateDomainsWithComma")
      );
    } else {
      return this.i18nService.t("separateDomainsWithComma");
    }
  });

  protected readonly showDeletionHours = new FormControl<boolean>(false);

  constructor(
    private readonly formBuilder: UntypedFormBuilder,
    private readonly orgDomainApiService: OrgDomainApiServiceAbstraction,
    private readonly i18nService: I18nService,
  ) {
    super();
    this.deletionHoursOptions = [
      { label: this.i18nService.t("oneHour"), value: SendDeletionDatePreset.OneHour },
      { label: this.i18nService.t("oneDay"), value: SendDeletionDatePreset.OneDay },
      { label: this.i18nService.t("days", "2"), value: SendDeletionDatePreset.TwoDays },
      { label: this.i18nService.t("days", "3"), value: SendDeletionDatePreset.ThreeDays },
      { label: this.i18nService.t("days", "7"), value: SendDeletionDatePreset.SevenDays },
      { label: this.i18nService.t("days", "14"), value: SendDeletionDatePreset.FourteenDays },
      { label: this.i18nService.t("days", "30"), value: SendDeletionDatePreset.ThirtyDays },
    ];
  }

  async ngOnInit() {
    // Fetch the org's claimed domains
    void this.fetchClaimedDomains();
    this.data
      .get("whoCanAccess")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const allowedDomainsControl = this.data.get("allowedDomains");
        if (!allowedDomainsControl) {
          return;
        }
        if (value === WhoCanAccessType.SpecificPeople) {
          allowedDomainsControl.setValidators([this.emailDomainValidator()]);
          if (!allowedDomainsControl.value) {
            allowedDomainsControl.setValue(this.claimedDomains());
          }
          this.showDomains.set(true);
        } else {
          allowedDomainsControl.clearValidators();
          allowedDomainsControl.patchValue(null);
          this.showDomains.set(false);
        }
      });
    // The actual boolean field in the policy is the opposite of its toggle
    this.enableSendControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enableSend) => {
        this.data.get("disableSend")?.patchValue(!enableSend);
      });
    this.data
      .get("deletionHours")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        // We don't emit an event here to prevent the following subscription from recursing
        this.showDeletionHours.patchValue(value != null, { emitEvent: false });
      });
    this.showDeletionHours.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((checked) => {
        this.data.patchValue({ deletionHours: checked ? SendDeletionDatePreset.ThreeDays : null });
      });

    // The MultiSelectComponent outputs full SelectItemView objects in its output array, but the
    // `allowedSendTypes` field is an array of SendTypes. We therefore bind the multi-select to a
    // separate form control and update the policy data field whenever it changes
    this.allowedSendTypesMultiSelectControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((values) => {
        this.data.get("allowedSendTypes")?.patchValue((values ?? []).map<SendType>((v) => v.value));
      });
    super.ngOnInit();
  }

  protected override loadData(): void {
    const policyResponseData =
      (this.policyResponse()?.data as SendControlsPolicyData) ?? new SendControlsPolicyData();
    if (policyResponseData.allowedSendTypes == null) {
      policyResponseData.allowedSendTypes = [SendType.Text, SendType.File];
    }
    if (policyResponseData.whoCanAccess == null) {
      policyResponseData.whoCanAccess = WhoCanAccessType.Any;
    }

    this.data.patchValue(policyResponseData);

    // The two separate form controls (enabled toggle and Send Types multi-select) must be initialized separately
    this.enableSendControl.patchValue(!(policyResponseData.disableSend ?? false));
    this.allowedSendTypesMultiSelectControl.patchValue(
      this.allSendTypeOptions().filter((asto) =>
        policyResponseData.allowedSendTypes.some((st) => st.toString() === asto.id),
      ),
    );
  }

  /** Fetches the organization's claimed domains */
  private async fetchClaimedDomains() {
    // Do not auto-populate if:
    // 1. The policy has no organizationId (so can't fetch claimed domains)
    // 2. The policy already exists and has domains specified by the user associated with it
    const orgId = this.policyResponse()?.organizationId;
    const hasExistingDomains = this.policyResponse()?.data?.allowedDomains != null;
    if (!orgId || hasExistingDomains) {
      return;
    }

    // Claimed domains come from an SSO/domain-gated endpoint. A user without that permission
    // (e.g. a custom role with only Manage policies) gets a 401, which ApiService turns into a
    // forced logout before this method's catch can run.
    const organization = await firstValueFrom(this.organization$);
    if (!organization?.canManageDomainVerification) {
      return;
    }

    try {
      const orgDomains = await this.orgDomainApiService.getAllByOrgId(orgId);
      if (orgDomains?.length) {
        this.claimedDomains.set(orgDomains.map((d) => d.domainName).join(", "));
      }
    } catch {
      // Silently handle errors - claimed domains are optional auto-fill
    }
  }

  emailDomainValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.value == null || control.value == "") {
        return null;
      }
      const emailDomainRegex = /^[^\s@]+\.[^\s@]+$/;
      const domains: string[] = control.value.split(",").map((d: string) => d.trim());
      const nonEmptyDomains = domains.filter((d) => d.length > 0);
      if (nonEmptyDomains.length === 0) {
        return {
          multipleDomainsInvalid: { message: this.i18nService.t("multipleInputDomainsInvalid") },
        };
      }
      const invalidDomains = nonEmptyDomains.filter((d) => !emailDomainRegex.test(d));
      if (invalidDomains.length > 0) {
        return {
          multipleDomainsInvalid: { message: this.i18nService.t("multipleInputDomainsInvalid") },
        };
      }
      return null;
    };
  }

  override buildRequest(orgKey?: OrgKey): Promise<SavePolicyRequest> {
    // This policy is always enabled, but unlike other policies whether it shows as such on the
    // policy admin screen is determined by whether or not the 'Enable Send' toggle is on or off.
    // Therefore when saving the policy we set both enabled and data fields directly
    return Promise.resolve({
      policy: {
        enabled: true,
        data: this.data.value,
      },
      metadata: null,
    });
  }
}
