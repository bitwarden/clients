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
  FormGroup,
  UntypedFormBuilder,
  ValidationErrors,
  ValidatorFn,
} from "@angular/forms";
import { Observable } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendControlsPolicyData } from "@bitwarden/common/tools/models/send-controls-policy-data";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { Option, SwitchComponent } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class SendControlsPolicy extends BasePolicyEditDefinition {
  name = "sendControls";
  description = "sendControlsPolicyDescV2";
  type = PolicyType.SendControls;
  category = PolicyCategory.DataControl;
  priority = 30;
  component = SendControlsPolicyComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.SendControls);
  }
}

@Component({
  selector: "send-controls-policy-edit",
  templateUrl: "send-controls.component.html",
  imports: [SharedModule, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendControlsPolicyComponent extends BasePolicyEditComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly data: FormGroup<ControlsOf<SendControlsPolicyData>> = this.formBuilder.group(
    new SendControlsPolicyData(),
  );
  private readonly dataFormValue = toSignal(this.data.valueChanges);

  protected readonly sendFeatureAllowed = computed(() => !this.dataFormValue()?.disableSend);

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

  constructor(
    private readonly formBuilder: UntypedFormBuilder,
    private readonly orgDomainApiService: OrgDomainApiServiceAbstraction,
    private readonly i18nService: I18nService,
  ) {
    super();
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
    this.enabled.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((enabled) => {
      if (!enabled) {
        this.data.disable();
      } else {
        this.data.enable();
      }
    });
    super.ngOnInit();
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
}
