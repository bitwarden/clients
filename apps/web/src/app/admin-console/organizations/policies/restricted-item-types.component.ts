import { Component, OnInit } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";
import { Observable } from "rxjs";

import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class RestrictedItemTypesPolicy extends BasePolicy {
  name = "restrictedItemTypePolicy";
  description = "restrictedItemTypePolicyDesc";
  type = PolicyType.RestrictedItemTypes;
  component = RestrictedItemTypesPolicyComponent;

  display(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.RemoveCardItemTypePolicy);
  }
}

export interface RestrictedItemTypesData {
  restrictedItemTypes: CipherType[];
}

@Component({
  selector: "policy-restricted-item-types",
  templateUrl: "restricted-item-types.component.html",
  standalone: false,
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyComponent implements OnInit {
  readonly CipherType = CipherType;

  // Available cipher types for restriction (excluding Login which is essential)
  readonly availableCipherTypes = [
    { type: CipherType.Card, translationKey: "typeCard" },
    { type: CipherType.Identity, translationKey: "typeIdentity" },
    { type: CipherType.SecureNote, translationKey: "typeSecureNote" },
    { type: CipherType.SshKey, translationKey: "typeSshKey" },
  ];

  constructor(private formBuilder: UntypedFormBuilder) {
    super();
  }

  ngOnInit(): void {
    // Initialize form with checkboxes for each cipher type
    const formControls: any = {};
    this.availableCipherTypes.forEach((cipherType) => {
      formControls[`restrictedType_${cipherType.type}`] = [false];
    });

    this.data = this.formBuilder.group(formControls);

    super.ngOnInit();
  }

  protected override loadData() {
    if (this.policyResponse?.data) {
      const restrictedTypes =
        (this.policyResponse.data as RestrictedItemTypesData)?.restrictedItemTypes || [];

      // Update form controls based on restricted types
      this.availableCipherTypes.forEach((cipherType) => {
        const controlName = `restrictedType_${cipherType.type}`;
        const isRestricted = restrictedTypes.includes(cipherType.type);
        this.data?.get(controlName)?.setValue(isRestricted);
      });
    }
  }

  protected override buildRequestData(): RestrictedItemTypesData {
    const restrictedItemTypes: CipherType[] = [];

    // Collect selected cipher types
    this.availableCipherTypes.forEach((cipherType) => {
      const controlName = `restrictedType_${cipherType.type}`;
      if (this.data?.get(controlName)?.value === true) {
        restrictedItemTypes.push(cipherType.type);
      }
    });

    return { restrictedItemTypes };
  }
}
