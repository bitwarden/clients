import { Injectable, Inject, NgZone, OnDestroy, DOCUMENT } from "@angular/core";

@Injectable({ providedIn: "root" })
export class AriaDisabledClickCaptureService implements OnDestroy {
  private listener!: (e: MouseEvent | KeyboardEvent) => void;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private ngZone: NgZone,
  ) {
    this.ngZone.runOutsideAngular(() => {
      this.listener = (e: MouseEvent | KeyboardEvent) => {
        const btn = (e.target as HTMLElement).closest(
          '[aria-disabled="true"][bit-aria-disable="true"]',
        );
        if (btn) {
          e.stopPropagation();
          e.preventDefault();
          return false;
        }
      };
      this.document.addEventListener("click", this.listener, /* capture */ true);
    });
  }

  ngOnDestroy() {
    this.document.removeEventListener("click", this.listener, true);
  }
}
