import { FocusKeyManager } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
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
import { OverflowListDirective } from "../../overflow-list";
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
    NgTemplateOutlet,
    RouterModule,
    TabHeaderComponent,
    TabListContainerDirective,
    TabListItemDirective,
    BerryComponent,
    IconModule,
    MenuModule,
    I18nPipe,
    OverflowListDirective,
  ],
})
export class TabNavBarComponent implements AfterViewInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;
  protected readonly TAB_LIST_CONTAINER_GAP = TAB_LIST_CONTAINER_GAP;

  private readonly injector = inject(Injector);

  private readonly moreButtonItem = viewChild.required("moreButton", {
    read: TabListItemDirective,
  });

  readonly tabLabels = contentChildren(forwardRef(() => TabLinkComponent));
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
      // Skip disabled items, items the overflow directive hid via [hidden], and the
      // visibility-hidden More button (aria-hidden="true" while no overflow exists).
      .skipPredicate(
        (item) =>
          item.disabled ||
          item.elementRef.nativeElement.hidden ||
          item.elementRef.nativeElement.getAttribute("aria-hidden") === "true",
      );

    this.keyManager.set(km);
  }

  updateActiveLink() {
    // Keep the keyManager in sync with active tabs
    const items = this.tabLabels();
    for (let i = 0; i < items.length; i++) {
      if (items[i].isActive()) {
        this.keyManager()?.updateActiveItem(i);
      }
    }
  }
}
