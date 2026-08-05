import { Injectable, inject } from "@angular/core";
import { FormGroup } from "@angular/forms";

import { ProblemDetailsErrorResponse } from "@bitwarden/common/models/response/problem-details-error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export type ProblemDetailsFieldMap = Record<string, Record<string, string>>;

@Injectable({ providedIn: "root" })
export class ProblemDetailsService {
  private i18nService = inject(I18nService);

  applyErrors(
    error: ProblemDetailsErrorResponse,
    formGroup: FormGroup,
    problemDetailFieldMap: ProblemDetailsFieldMap,
  ): void {
    for (const [field, details] of Object.entries(error.errors)) {
      const fieldMap = problemDetailFieldMap[field];
      const control = formGroup.get(field);
      if (!fieldMap || !control) {
        continue;
      }

      const i18nKey = details.map((d) => fieldMap[d.type]).find(Boolean);
      if (i18nKey) {
        control.setErrors({ serverError: { message: this.i18nService.t(i18nKey) } });
      }
    }
  }
}
