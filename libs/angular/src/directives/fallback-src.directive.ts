// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, HostListener, Input } from "@angular/core";

@Directive({
  selector: "[appFallbackSrc]",
  standalone: false,
})
export class FallbackSrcDirective {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input("appFallbackSrc") appFallbackSrc: string;

  /** Only try setting the fallback once. This prevents an infinite loop if the fallback itself is missing. */
  private tryFallback = true;

  constructor(private el: ElementRef) {}

  @HostListener("error") onError() {
    if (this.tryFallback) {
      this.el.nativeElement.src = this.appFallbackSrc;
      this.tryFallback = false;
    }
  }
}
