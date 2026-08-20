import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { outputFromObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";

import { SideNavService } from "./side-nav.service";

/**
 * An empty-state message shown inside a `bit-nav-section` when the section has no items.
 * Renders a subtle bordered box with projected message content and, when a consumer binds
 * `(dismiss)`, a close button. Hidden when the side nav is collapsed.
 */
@Component({
  selector: "bit-nav-section-empty",
  templateUrl: "./nav-section-empty.component.html",
  imports: [IconButtonModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavSectionEmptyComponent implements OnInit {
  protected readonly sideNavService = inject(SideNavService);

  private readonly dismiss$ = new Subject<void>();
  /**
   * Emitted when the user clicks the close button. The close button is only rendered when this
   * output is bound by the consumer; if no listener is attached, no dismiss control is shown.
   */
  readonly dismiss = outputFromObservable(this.dismiss$);
  protected readonly isDismissible = signal(false);

  ngOnInit() {
    this.isDismissible.set(this.dismiss$.observed);
  }

  protected onDismiss(): void {
    this.dismiss$.next();
  }
}
