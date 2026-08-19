import { Pipe, PipeTransform, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AccessCondition, approvalMethodLabelKeys } from "..";

/** Projects a rule's conditions into its comma-joined, translated approval-method text. */
@Pipe({ name: "approvalMethod" })
export class ApprovalMethodPipe implements PipeTransform {
  private readonly i18nService = inject(I18nService);

  transform(conditions: AccessCondition[]): string {
    return approvalMethodLabelKeys(conditions)
      .map((key) => this.i18nService.t(key))
      .join(", ");
  }
}
