// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, Input, OnChanges } from "@angular/core";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

/**
 * Provides error handling, in particular for any error returned by the server in an api call.
 * Attach it to a <form> element and provide the name of the class property that will hold the api call promise.
 * e.g. <form [appApiAction]="this.formPromise">
 * Any errors/rejections that occur will be intercepted and displayed as error toasts.
 *
 * @deprecated Use the CL's {@link BitSubmitDirective} instead
 */
@Directive({
  selector: "[appApiAction]",
})
export class ApiActionDirective implements OnChanges {
  @Input() appApiAction: Promise<any>;

  constructor(
    private el: ElementRef,
    private validationService: ValidationService,
    private logService: LogService,
  ) {}

  ngOnChanges(changes: any) {
    if (this.appApiAction == null || this.appApiAction.then == null) {
      return;
    }

    this.el.nativeElement.loading = true;

    this.appApiAction.then(
      (response: any) => {
        this.el.nativeElement.loading = false;
      },
      (e: any) => {
        this.el.nativeElement.loading = false;

        if ((e as ErrorResponse).captchaRequired) {
          this.logService.error("Captcha required error response: " + e.getSingleMessage());
          return;
        }
        this.logService?.error(`Received API exception:`, e);
        this.validationService.showError(e);
      },
    );
  }
}
