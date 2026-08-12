import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  input,
  inject,
  signal,
  computed,
  model,
  contentChildren,
} from "@angular/core";
import { RouterModule, RouterLinkActive } from "@angular/router";

import { IconComponent } from "../icon";
import { IconButtonModule } from "../icon-button";
import { IconTileComponent } from "../icon-tile";

import { NavBaseComponent } from "./nav-base.component";
import { SideNavService } from "./side-nav.service";

/**
 * Utility classes for the focus-visible-within ring. Exported so snapshot stories can force the
 * focused state directly — focus-visible-within is JS-driven (see `fvwStyles`) and has no CSS
 * variant to trigger — without duplicating (and drifting from) the class list.
 */
export const FVW_RING_CLASSES =
  "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-border-nav-focus tw-bg-bg-nav-hover";

/** Version 1 keeps the inset ring; the outset ring above is a version 2 design change. */
export const FVW_RING_CLASSES_V1 =
  "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-inset tw-ring-border-nav-focus tw-bg-bg-nav-hover";

// Resolves a circular dependency between `NavItemComponent` and `NavItemGroup` when using standalone components.
export abstract class NavGroupAbstraction {
  abstract setOpen(open: boolean): void;
  abstract treeDepth: ReturnType<typeof model<number>>;
}

@Component({
  selector: "bit-nav-item",
  templateUrl: "./nav-item.component.html",
  providers: [{ provide: NavBaseComponent, useExisting: NavItemComponent }],
  imports: [NgTemplateOutlet, IconButtonModule, RouterModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(focusin)": "onFocusIn($event.target)",
    "(focusout)": "onFocusOut()",
    class: "tw-block",
  },
})
export class NavItemComponent extends NavBaseComponent {
  /**
   * Base padding for nav items (in rem)
   * This provides the initial indentation for nav items before depth-based padding
   */
  private readonly TREE_BASE_PADDING = 2.25;

  /**
   * Padding increment per tree depth level (in rem)
   * Each nested level adds this amount of padding to visually indicate hierarchy
   */
  private readonly TREE_DEPTH_PADDING = 1.5;

  /**
   * Forces active styles to be shown, regardless of the `routerLinkActiveOptions`
   */
  readonly forceActiveStyles = input<boolean>(false);

  /**
   * Leading tile projected directly into this item's `start` slot (standalone use). A composing
   * nav-group re-projects its tile instead, which this query cannot see — see `hasForwardedIconTile`.
   */
  private readonly startSlotTiles = contentChildren(IconTileComponent);

  /**
   * Set by a composing nav-group when it forwards a `[slot=start]` icon tile into this item.
   * Re-projected content is invisible to `startSlotTiles`, so the group reports it explicitly.
   */
  readonly hasForwardedIconTile = input(false);

  /**
   * Whether this item's `start` slot holds an icon tile that should act as its leading glyph
   * (inside the interactive element) and its collapsed-rail glyph.
   */
  protected readonly hasStartIconTile = computed(
    () => this.hasForwardedIconTile() || this.startSlotTiles().length > 0,
  );

  protected readonly sideNavService = inject(SideNavService);
  private readonly parentNavGroup = inject(NavGroupAbstraction, { optional: true });

  /**
   * Is `true` if `to` matches the current route
   */
  private readonly _isActive = signal(false);
  protected setIsActive(isActive: boolean) {
    this._isActive.set(isActive);
    if (isActive && this.parentNavGroup) {
      this.parentNavGroup.setOpen(true);
    }
  }
  protected readonly showActiveStyles = computed(
    () => this.forceActiveStyles() || (this._isActive() && !this.hideActiveStyles()),
  );

  /**
   * Adding calculation for nav items due to needing visual alignment on different indentation levels needed between the first level and subsequent levels
   */
  protected readonly navItemIndentationPadding = computed(() => {
    const open = this.sideNavService.open();
    const depth = this.treeDepth() ?? 0;

    if (open) {
      return `${this.TREE_BASE_PADDING + depth * this.TREE_DEPTH_PADDING}rem`;
    }

    return "0";
  });

  /**
   * Allow overriding of the RouterLink['ariaCurrentWhenActive'] property.
   *
   * Useful for situations like nav-groups that navigate to their first child page and should
   * not be marked `current` while the child page is marked as `current`
   */
  readonly ariaCurrentWhenActive = input<RouterLinkActive["ariaCurrentWhenActive"]>("page");

  /**
   * `aria-expanded` for the interactive element. Set by a composing component (e.g. a nav group)
   * when the item's main row toggles expandable content instead of a dedicated button. Left
   * `undefined` for plain nav items so no attribute is rendered.
   */
  readonly ariaExpanded = input<boolean | undefined>(undefined);

  /**
   * `aria-controls` for the interactive element — the id of the region the item expands/collapses.
   */
  readonly ariaControls = input<string | undefined>(undefined);

  /**
   * By default, a navigation will put the user's focus on the `main` element.
   *
   * If the user's focus should be moved to another element upon navigation end, pass a selector
   * here (i.e. `#elementId`).
   *
   * Pass `false` to opt out of moving the focus entirely. Focus will stay on the nav item.
   *
   * See router-focus-manager.service for implementation of focus management
   */
  readonly focusAfterNavTarget = input<string | boolean>();

  /**
   * The design spec calls for the an outline to wrap the entire element when the template's
   * anchor/button has :focus-visible. Usually, we would use :focus-within for this. However, that
   * matches when a child element has :focus instead of :focus-visible.
   *
   * Currently, the browser does not have a pseudo selector that combines these two, e.g.
   * :focus-visible-within (WICG/focus-visible#151). To make our own :focus-visible-within
   * functionality, we use event delegation on the host and manually check if the focus target
   * (denoted with the data-fvw attribute) matches :focus-visible. We then map that state to some
   * styles, so the entire component can have an outline.
   */
  protected readonly focusVisibleWithin = signal(false);
  protected readonly fvwStyles = computed(() => {
    if (!this.focusVisibleWithin()) {
      return "";
    }
    return this.sideNavService.version() === "vfo1" ? FVW_RING_CLASSES : FVW_RING_CLASSES_V1;
  });

  protected onFocusIn(target: EventTarget) {
    this.focusVisibleWithin.set((target as HTMLElement).matches("[data-fvw]:focus-visible"));
  }

  protected onFocusOut() {
    this.focusVisibleWithin.set(false);
  }

  /**
   * Routes clicks in the trailing `end` slot: clicks on a control (e.g. a consumer action button)
   * stay contained and don't trigger the row, while clicks on decorative content — like a nav
   * group's collapse chevron — behave like a click on the row itself.
   */
  protected onEndSlotClick(event: MouseEvent) {
    const isInteractive = (event.target as HTMLElement).closest(
      "a, button, input, select, textarea, [role='button']",
    );
    if (isInteractive) {
      event.stopPropagation();
    } else {
      this.mainContentClicked.emit();
    }
  }

  constructor() {
    super();

    // Set tree depth based on parent's depth
    if (this.parentNavGroup) {
      this.treeDepth.set(this.parentNavGroup.treeDepth() + 1);
    }
  }
}
