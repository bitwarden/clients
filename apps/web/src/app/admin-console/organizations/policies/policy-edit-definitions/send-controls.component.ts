import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AbstractControl, UntypedFormBuilder, ValidationErrors, ValidatorFn } from "@angular/forms";
import { Observable } from "rxjs";

import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { WhoCanAccessType } from "@bitwarden/send-ui";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditDefinition, BasePolicyEditComponent } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class SendControlsPolicy extends BasePolicyEditDefinition {
  name = "sendControls";
  description = "sendControlsPolicyDesc";
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
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendControlsPolicyComponent extends BasePolicyEditComponent implements OnInit {
  readonly WhoCanAccessType = WhoCanAccessType;

  private readonly destroyRef = inject(DestroyRef);

  readonly data = this.formBuilder.group({
    disableSend: false,
    disableHideEmail: false,
    whoCanAccess: WhoCanAccessType.Any as WhoCanAccessType,
    allowedDomains: null as string | null,
  });

  readonly sendFeatureEnabled = signal(true);
  /** Whether the allowed domains text area should be displayed */
  readonly showDomains = signal(false);
  private readonly claimedDomains = signal<string | null>(null);
  readonly showAllowedDomainsAutopopulateAlert = signal(false);
  onDismissCallout() {
    this.showAllowedDomainsAutopopulateAlert.set(false);
  }

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
      .subscribe((value: WhoCanAccessType) => {
        const allowedDomainsControl = this.data.get("allowedDomains");
        if (value === WhoCanAccessType.SpecificPeople) {
          allowedDomainsControl?.setValidators([this.emailDomainValidator()]);
          const claimedDomains = this.claimedDomains();
          if (claimedDomains != null) {
            this.showAllowedDomainsAutopopulateAlert.set(true);
          }
          allowedDomainsControl?.setValue(claimedDomains);
          this.showDomains.set(true);
        } else {
          this.showAllowedDomainsAutopopulateAlert.set(false);
          allowedDomainsControl?.clearValidators();
          allowedDomainsControl?.patchValue(null);
          this.showDomains.set(false);
        }
      });
    this.data
      .get("disableSend")
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: boolean) => {
        this.data.get("whoCanAccess")?.patchValue(WhoCanAccessType.Any);
        this.data.get("disableHideEmail")?.patchValue(false);
        this.sendFeatureEnabled.set(!value);
      });
    this.data.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      // If the policy has no settings that change default behavior, the policy can be disabled
      this.enabled.patchValue(
        !(
          !value.disableSend &&
          value.whoCanAccess === WhoCanAccessType.Any &&
          !value.disableHideEmail
        ),
      );
    });
    super.ngOnInit();
  }

  /** Fetches the organization's claimed domains */
  private async fetchClaimedDomains() {
    // Do not auto-populate if:
    // 1. The policy has no organizationId (so can't fetch claimed domains)
    // 2. The policy already exists and has domains specified by the user associated with it
    const orgId = this.policyResponse?.organizationId;
    const hasExistingDomains = this.policyResponse?.data?.allowedDomains != null;
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
      const domains = control.value.split(",").map((d: string) => d.trim());
      const nonEmptyDomains = domains.filter((d: string) => d.length > 0);
      if (nonEmptyDomains.length === 0) {
        return {
          multipleDomainsInvalid: { message: this.i18nService.t("multipleInputDomainsInvalid") },
        };
      }
      const invalidDomains = nonEmptyDomains.filter((d: string) => !emailDomainRegex.test(d));
      if (invalidDomains.length > 0) {
        return {
          multipleDomainsInvalid: { message: this.i18nService.t("multipleInputDomainsInvalid") },
        };
      }
      return null;
    };
  }
}
