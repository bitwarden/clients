import { CdkScrollable } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, Signal, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

/**
 * Body container for `bit-drawer`
 */
@Component({
  selector: "bit-drawer-body",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class:
      "tw-p-4 tw-pt-0 tw-block tw-overflow-auto tw-border-solid tw-border tw-border-transparent tw-transition-colors tw-duration-200",
    "[class.tw-border-t-secondary-300]": "isScrolled()",
  },
  hostDirectives: [
    {
      directive: CdkScrollable,
    },
  ],
  template: ` <ng-content></ng-content> `,
})
export class DrawerBodyComponent {
  private scrollable = inject(CdkScrollable);

  /** TODO: share this utility with browser popup header? */
  protected isScrolled: Signal<boolean> = toSignal(
    this.scrollable
      .elementScrolled()
      .pipe(map(() => this.scrollable.measureScrollOffset("top") > 0)),
    { initialValue: false },
  );
}
