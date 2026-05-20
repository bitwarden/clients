import { FocusKeyManager } from "@angular/cdk/a11y";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  contentChildren,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../../berry";
import { IconModule } from "../../icon";
import { MenuModule } from "../../menu";
import { OverflowListDirective, OverflowTriggerDirective } from "../../overflow-list";
import { TabHeaderComponent } from "../shared/tab-header.component";
import {
  TAB_LIST_CONTAINER_GAP,
  TabListContainerDirective,
} from "../shared/tab-list-container.directive";
import { TAB_LABEL_CONTENT_CLASSES, TabListItemDirective } from "../shared/tab-list-item.directive";

import { TabLinkComponent } from "./tab-link.component";

@Component({
  selector: "bit-tab-nav-bar",
  templateUrl: "tab-nav-bar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
  },
  imports: [
    RouterModule,
    TabHeaderComponent,
    TabListContainerDirective,
    TabListItemDirective,
    BerryComponent,
    IconModule,
    MenuModule,
    I18nPipe,
    OverflowListDirective,
    OverflowTriggerDirective,
  ],
})
export class TabNavBarComponent implements AfterViewInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;
  protected readonly TAB_LIST_CONTAINER_GAP = TAB_LIST_CONTAINER_GAP;

  private readonly injector = inject(Injector);

  private readonly moreButtonItem = viewChild.required("moreButton", {
    read: TabListItemDirective,
  });

  readonly tabLabels = contentChildren<TabLinkComponent>(forwardRef(() => TabLinkComponent));
  /** Map projected tab-links to their host OverflowItemDirective for the parent list. */
  protected readonly overflowItems = computed(() => this.tabLabels().map((t) => t.overflowItem));
  readonly label = input("");

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  private readonly allTabItems = computed<(TabLinkComponent | TabListItemDirective)[]>(() => [
    ...this.tabLabels(),
    this.moreButtonItem(),
  ]);

  readonly keyManager = signal<
    FocusKeyManager<TabLinkComponent | TabListItemDirective> | undefined
  >(undefined);

  ngAfterViewInit(): void {
    const km = new FocusKeyManager(this.allTabItems, this.injector)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd()
      // Skip disabled items and anything the overflow directive hid via [hidden]
      // (overflowed tabs as well as the More button when there's nothing to surface).
      .skipPredicate((item) => item.disabled || item.elementRef.nativeElement.hidden);

    this.keyManager.set(km);
    // Seed roving tabindex now that tab-links have populated their isActive signals.
    this.updateActiveLink();
  }

  /**
   * When the overflow menu closes, the CDK overlay restores focus to the More
   * button trigger, but the key manager's active item points at the newly
   * active route (set during `updateActiveLink`). Realign the key manager to
   * the trigger so the next arrow key behaves relative to where focus is.
   */
  protected onOverflowMenuClosed() {
    this.keyManager()?.updateActiveItem(this.moreButtonItem());
  }

  updateActiveLink() {
    const items = this.tabLabels();
    if (items.length === 0) {
      return;
    }

    // Roving tabindex: one link is the nav's tab stop, arrows move between the rest.
    // Falls back to the first non-disabled link when no route is active (initial load,
    // unmatched route) so the nav stays focusable.
    const activeIdx = items.findIndex((l) => l.isActive() && !l.disabled);
    const focusableIdx = activeIdx >= 0 ? activeIdx : items.findIndex((l) => !l.disabled);
    items.forEach((link, i) => link.tabIndex.set(i === focusableIdx ? 0 : -1));

    if (activeIdx >= 0) {
      this.keyManager()?.updateActiveItem(activeIdx);
    }
  }
}
