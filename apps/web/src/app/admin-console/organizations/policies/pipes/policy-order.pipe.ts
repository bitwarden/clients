import { Pipe, PipeTransform } from "@angular/core";

import { BasePolicyEditDefinition } from "../base-policy-edit.component";

@Pipe({
  name: "policyOrder",
  standalone: true,
})
export class PolicyOrderPipe implements PipeTransform {
  transform(
    policies: readonly BasePolicyEditDefinition[] | null | undefined,
  ): BasePolicyEditDefinition[] {
    if (policies == null || policies.length === 0) {
      return [];
    }

    return [...policies].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return policies.indexOf(a) - policies.indexOf(b);
    });
  }
}
