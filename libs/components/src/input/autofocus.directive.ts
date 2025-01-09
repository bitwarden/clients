// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, Input, NgZone, OnInit, Optional } from "@angular/core";
import { take } from "rxjs/operators";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { FocusableElement } from "../shared/focusable-element";

/**
 * Directive to focus an element.
 *
 * @remarks
 *
 * If the component provides the `FocusableElement` interface, the `focus`
 * method will be called. Otherwise, the native element will be focused.
 */
@Directive({
  selector: "[appAutofocus], [bitAutofocus]",
})
export class AutofocusDirective implements OnInit {
  @Input() set appAutofocus(condition: boolean | string) {
    this.autofocus = condition === "" || condition === true;
  }

  private autofocus: boolean;

  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
    @Optional() private focusableElement: FocusableElement,
  ) {}

  ngOnInit() {
    if (!Utils.isMobileBrowser && this.autofocus) {
      if (this.ngZone.isStable) {
        this.focus();
      } else {
        this.ngZone.onStable.pipe(take(1)).subscribe(this.focus.bind(this));
      }
    }
  }

  private focus() {
    if (this.focusableElement) {
      this.focusableElement.getFocusTarget().focus();
    } else {
      this.el.nativeElement.focus();
    }
  }
}
