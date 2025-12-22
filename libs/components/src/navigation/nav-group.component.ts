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
  computed,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterLinkActive } from "@angular/router";

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
  // Query direct children for hideIfEmpty functionality
  readonly nestedNavComponents = contentChildren(NavBaseComponent, { descendants: false });

  readonly sideNavOpen = toSignal(this.sideNavService.open$);

  readonly sideNavAndGroupOpen = computed(() => {
    return this.open() && this.sideNavOpen();
  });

  /** When the side nav is open, the parent nav item should not show active styles when open. */
  readonly parentHideActiveStyles = computed(() => {
    return this.hideActiveStyles() || this.sideNavAndGroupOpen();
  });

  /**
   * Determines the appropriate icon for the toggle button based on variant and open state.
   * - Tree variant: Always uses 'bwi-up-solid'
   * - Default variant: Uses 'bwi-angle-up' when open, 'bwi-angle-down' when closed
   */
  readonly toggleButtonIcon = computed(() => {
    if (this.variant() === "tree") {
      return "bwi-up-solid";
    }
    return this.open() ? "bwi-angle-up" : "bwi-angle-down";
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

    // Set tree depth based on parent's depth
    // Both NavGroups and NavItems use constructor-based depth initialization
    if (this.parentNavGroup) {
      this.treeDepth.set(this.parentNavGroup.treeDepth() + 1);
    }
  }

  setOpen(isOpen: boolean) {
    this.open.set(isOpen);
    this.openChange.emit(this.open());
    if (this.open()) {
      this.parentNavGroup?.setOpen(this.open());
    }
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
