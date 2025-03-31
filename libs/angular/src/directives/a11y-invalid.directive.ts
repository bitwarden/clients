// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, OnDestroy, OnInit } from "@angular/core";
import { NgControl } from "@angular/forms";
import { Subscription } from "rxjs";

@Directive({
  selector: "[appA11yInvalid]",
})
export class A11yInvalidDirective implements OnDestroy, OnInit {
  private sub: Subscription;

  constructor(
    private el: ElementRef<HTMLInputElement>,
    private formControlDirective: NgControl,
  ) {}

  ngOnInit() {
    this.sub = this.formControlDirective.control.statusChanges.subscribe((status) => {
      if (status === "INVALID") {
        this.el.nativeElement.setAttribute("aria-invalid", "true");
      } else if (status === "VALID") {
        this.el.nativeElement.setAttribute("aria-invalid", "false");
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
