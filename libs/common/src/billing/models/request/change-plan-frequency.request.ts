import { PlanType } from "../../enums";

export class ChangePlanFrequencyRequest {
  newPlanType: PlanType;

  constructor(newPlanType?: PlanType) {
    this.newPlanType = newPlanType!;
  }
}
