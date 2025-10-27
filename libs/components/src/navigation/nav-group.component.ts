import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  Component,
  EventEmitter,
  Optional,
  Output,
  SkipSelf,
  input,
  model,
  contentChildren,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";

import { NavBaseComponent } from "./nav-base.component";
import { NavGroupAbstraction, NavItemComponent } from "./nav-item.component";
import { SideNavService } from "./side-nav.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-nav-group",
  templateUrl: "./nav-group.component.html",
  providers: [
    { provide: NavBaseComponent, useExisting: NavGroupComponent },
    { provide: NavGroupAbstraction, useExisting: NavGroupComponent },
  ],
  imports: [CommonModule, NavItemComponent, IconButtonModule, I18nPipe],
})
export class NavGroupComponent extends NavBaseComponent {
  readonly nestedNavComponents = contentChildren(NavBaseComponent, { descendants: true });

  /** When the side nav is open, the parent nav item should not show active styles when open. */
  protected get parentHideActiveStyles(): boolean {
    return this.hideActiveStyles() || (this.open() && this.sideNavService.open);
  }

  /**
   * UID for `[attr.aria-controls]`
   */
  protected contentId = Math.random().toString(36).substring(2);

  /**
   * Is `true` if the expanded content is visible
   */
  readonly open = model(false);

  /**
   * Automatically hide the nav group if there are no child buttons
   */
  readonly hideIfEmpty = input(false, { transform: booleanAttribute });

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  openChange = new EventEmitter<boolean>();

  constructor(
    protected sideNavService: SideNavService,
    @Optional() @SkipSelf() private parentNavGroup: NavGroupComponent,
  ) {
    super();
  }

  setOpen(isOpen: boolean) {
    this.open.set(isOpen);
    this.openChange.emit(this.open());
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.open() && this.parentNavGroup?.setOpen(this.open());
  }

  protected toggle(event?: MouseEvent) {
    event?.stopPropagation();
    this.setOpen(!this.open());
  }

  protected handleMainContentClicked() {
    if (!this.sideNavService.open) {
      if (!this.route()) {
        this.sideNavService.setOpen();
      }
      this.open.set(true);
    } else {
      this.toggle();
    }
    this.mainContentClicked.emit();
  }
}
