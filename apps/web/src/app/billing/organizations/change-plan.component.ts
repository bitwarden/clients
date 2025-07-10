// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

@Component({
  selector: "app-change-plan",
  templateUrl: "change-plan.component.html",
  standalone: false,
})
export class ChangePlanComponent {
  @Input() organizationId: string;
  @Input() currentPlan: PlanResponse;
  @Input() preSelectedProductTier: ProductTierType;
  @Output() onChanged = new EventEmitter();
  @Output() onCanceled = new EventEmitter();

  formPromise: Promise<any>;

  constructor(private logService: LogService) {}

  async submit() {
    try {
      this.onChanged.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }

  cancel() {
    this.onCanceled.emit();
  }
}
