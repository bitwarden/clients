import { ErrorResponse } from "../../models/response/error.response";
import { I18nService } from "../abstractions/i18n.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { ValidationService as ValidationServiceAbstraction } from "../abstractions/validation.service";

export class ValidationService implements ValidationServiceAbstraction {
  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  showError(data: any): string[] {
    const defaultErrorMessage = this.i18nService.t("unexpectedError");
    let errors: string[] = [];

    if (data != null && typeof data === "string") {
      errors.push(data);
    } else if (data == null || typeof data !== "object") {
      errors.push(defaultErrorMessage);
    } else if (data.validationErrors != null) {
      errors = errors.concat((data as ErrorResponse).getAllMessages());
    } else {
      errors.push(data.message ? data.message : defaultErrorMessage);
    }

    if (errors.length === 1) {
      this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), errors[0]);
    } else if (errors.length > 1) {
      this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), errors, {
        timeout: 5000 * errors.length,
      });
    }

    return errors;
  }
}
