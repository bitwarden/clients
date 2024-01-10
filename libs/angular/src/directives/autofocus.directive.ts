import { Directive, ElementRef, Input, NgZone, OnInit } from "@angular/core";
import { take } from "rxjs/operators";

import { Utils } from "@bitwarden/common/platform/misc/utils";

@Directive({
  selector: "[appAutofocus]",
})
export class AutofocusDirective implements OnInit {
  @Input() set appAutofocus(condition: boolean | string) {
    this.autofocus = condition === "" || condition === true;
  }

  private autofocus: boolean;

  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    if (!Utils.isMobileBrowser && this.autofocus) {
      if (this.ngZone.isStable) {
        this.el.nativeElement.focus();
      } else {
        this.ngZone.onStable.pipe(take(1)).subscribe(() => this.el.nativeElement.focus());
      }
    }
  }
}
