import { NgTemplateOutlet } from "@angular/common";
import {
  booleanAttribute,
  Component,
  inject,
  input,
  model,
  contentChildren,
  ChangeDetectionStrategy,
  computed,
} from "@angular/core";
import { RouterLinkActive } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";

import { NavBaseComponent } from "./nav-base.component";
import { NavGroupAbstraction, NavItemComponent } from "./nav-item.component";
import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-nav-group",
  templateUrl: "./nav-group.component.html",
  providers: [
    { provide: NavBaseComponent, useExisting: NavGroupComponent },
    { provide: NavGroupAbstraction, useExisting: NavGroupComponent },
  ],
  imports: [NgTemplateOutlet, NavItemComponent, IconButtonModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavGroupComponent extends NavBaseComponent {
  protected readonly sideNavService = inject(SideNavService);
  private readonly parentNavGroup = inject(NavGroupComponent, { optional: true, skipSelf: true });

  readonly nestedNavComponents = contentChildren(NavBaseComponent, { descendants: true });

  protected readonly sideNavOpen = this.sideNavService.open;

  readonly sideNavAndGroupOpen = computed(() => {
    return this.open() && this.sideNavOpen();
  });

  /** When the side nav is open, the parent nav item should not show active styles when open. */
  protected readonly parentHideActiveStyles = computed(() => {
    return this.hideActiveStyles() || this.sideNavAndGroupOpen();
  });

  /**
   * Allow overriding of the RouterLink['ariaCurrentWhenActive'] property.
   *
   * By default, assuming that the nav group navigates to its first child page instead of its
   * own page, the nav group will be `current` when the side nav is collapsed or the nav group
   * is collapsed (since child pages don't show in either collapsed view) and not `current`
   * when the side nav and nav group are open (since the child page will show as `current`).
   *
   * If the nav group navigates to its own page, use this property to always set it to announce
   * as `current` by passing in `"page"`.
   */
  readonly ariaCurrentWhenActive = input<RouterLinkActive["ariaCurrentWhenActive"]>();

  readonly ariaCurrent = computed(() => {
    return this.ariaCurrentWhenActive() ?? (this.sideNavAndGroupOpen() ? undefined : "page");
  });

  /**
   * UID for `[attr.aria-controls]`
   */
  protected readonly contentId = Math.random().toString(36).substring(2);

  /**
   * Is `true` if the expanded content is visible
   */
  readonly open = model(false);

  /**
   * Automatically hide the nav group if there are no child buttons
   */
  readonly hideIfEmpty = input(false, { transform: booleanAttribute });

  setOpen(isOpen: boolean) {
    this.open.set(isOpen);
    if (this.open() && this.parentNavGroup) {
      this.parentNavGroup.setOpen(this.open());
    }
  }

  protected toggle(event?: MouseEvent) {
    event?.stopPropagation();
    this.setOpen(!this.open());
  }

  protected handleMainContentClicked() {
    if (!this.sideNavService.open()) {
      if (!this.route()) {
        this.sideNavService.open.set(true);
      }
      this.open.set(true);
    } else {
      this.toggle();
    }
    this.mainContentClicked.emit();
  }
}
