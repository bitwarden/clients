import { Component, EventEmitter, Input, Output, OnInit } from "@angular/core";
import { FormGroup } from "@angular/forms";

import { PlanType } from "@bitwarden/common/billing/enums";
import { ProductType } from "@bitwarden/common/enums";

import { OrganizationPlansComponent } from "../../organizations";

@Component({
  selector: "app-billing",
  templateUrl: "./billing.component.html",
})
export class BillingComponent extends OrganizationPlansComponent implements OnInit {
  @Input() orgInfoForm: FormGroup;
  @Output() previousStep = new EventEmitter();

  async ngOnInit() {
    const additionalSeats =
      this.product == ProductType.Families || this.plan === PlanType.TeamsStarter ? 0 : 1;
    this.formGroup.patchValue({
      name: this.orgInfoForm.value.name,
      billingEmail: this.orgInfoForm.value.email,
      additionalSeats: additionalSeats,
      plan: this.plan,
      product: this.product,
    });
    this.isInTrialFlow = true;
    await super.ngOnInit();
  }

  stepBack() {
    this.previousStep.emit();
  }
}
