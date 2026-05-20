import { FocusKeyManager } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  AfterContentChecked,
  AfterViewInit,
  Component,
  contentChild,
  contentChildren,
  effect,
  input,
  model,
  output,
  viewChild,
  viewChildren,
  inject,
  Injector,
  signal,
  untracked,
  ChangeDetectionStrategy,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../../berry";
import { IconModule } from "../../icon";
import { MenuModule } from "../../menu";
import {
  OverflowItemDirective,
  OverflowListDirective,
  OverflowTriggerDirective,
} from "../../overflow-list";
import { TabHeaderComponent } from "../shared/tab-header.component";
import {
  TAB_LIST_CONTAINER_GAP,
  TabListContainerDirective,
} from "../shared/tab-list-container.directive";
import { TAB_LABEL_CONTENT_CLASSES, TabListItemDirective } from "../shared/tab-list-item.directive";

import { TabBodyComponent } from "./tab-body.component";
import { TabComponent } from "./tab.component";

/** Used to generate unique ID's for each tab component */
let nextId = 0;

@Component({
  selector: "bit-tab-group",
  templateUrl: "./tab-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Block-level so the host fills its parent. Without this, the chain
  // (host → bit-tab-header → tablist row) sizes to content and can't recover
  // its width after collapsing to a single truncated tab.
  host: {
    class: "tw-block",
  },
  imports: [
    NgTemplateOutlet,
    TabHeaderComponent,
    TabListContainerDirective,
    TabListItemDirective,
    TabBodyComponent,
    BerryComponent,
    IconModule,
    MenuModule,
    I18nPipe,
    OverflowListDirective,
    OverflowItemDirective,
    OverflowTriggerDirective,
  ],
})
export class TabGroupComponent implements AfterContentChecked, AfterViewInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;
  protected readonly TAB_LIST_CONTAINER_GAP = TAB_LIST_CONTAINER_GAP;

  private readonly injector = inject(Injector);

  private readonly _groupId: number;

  /** Aria label for the tab list menu */
  readonly label = input("");

  /**
   * Keep the content of off-screen tabs in the DOM.
   * Useful for keeping `audio` or `video` elements from re-initializing
   * after navigating between tabs.
   */
  readonly preserveContent = input(false);

  /** Error if no `TabComponent` is supplied. (`contentChildren`, used to query for all the tabs, doesn't support `required`) */
  private readonly _tab = contentChild.required(TabComponent);

  protected readonly tabs = contentChildren(TabComponent);
  readonly tabLabels = viewChildren(TabListItemDirective);
  private readonly moreButton = viewChild("moreButton", { read: TabListItemDirective });

  /** The index of the active tab. Supports two-way binding via `[(selectedIndex)]`. */
  readonly selectedIndex = model(0);

  private readonly _selectedIndex = signal<number | null>(null);

  /** Guards against premature `selectedTabChange` emissions before tabs are initialized. */
  private readonly _initialized = signal(false);

  /** Event emitted when the tab selection has changed. */
  readonly selectedTabChange = output<BitTabChangeEvent>();

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  readonly keyManager = signal<FocusKeyManager<TabListItemDirective> | undefined>(undefined);

  constructor() {
    this._groupId = nextId++;

    effect(() => {
      const indexToSelect = this._clampTabIndex(this.selectedIndex());

      // If the selected tab didn't explicitly change, keep the previously
      // selected tab selected/active
      if (indexToSelect === this._selectedIndex()) {
        const tabs = this.tabs();
        let selectedTab: TabComponent | undefined;

        const activeTab = tabs.find((tab) => tab.isActive());

        if (activeTab) {
          const activeIndex = tabs.indexOf(activeTab);
          // Set both selectedIndex and _selectedIndex to avoid firing a change
          // event which could cause an infinite loop if adding a tab within the
          // selectedIndex change event
          this.selectedIndex.set(activeIndex);
          this._selectedIndex.set(activeIndex);
          selectedTab = activeTab;
        }

        // No active tab found and a tab does exist means the active tab
        // was removed, so a new active tab must be set manually
        if (!selectedTab && tabs[indexToSelect]) {
          tabs[indexToSelect].isActive.set(true);
          if (untracked(() => this._initialized())) {
            this.selectedTabChange.emit({
              index: indexToSelect,
              tab: tabs[indexToSelect],
            });
          }
        }
      }
    });
  }

  protected getTabContentId(id: number): string {
    return `bit-tab-content-${this._groupId}-${id}`;
  }

  protected getTabLabelId(id: number): string {
    return `bit-tab-label-${this._groupId}-${id}`;
  }

  selectTab(index: number) {
    this.selectedIndex.set(index);
  }

  /**
   * When the overflow menu closes, the CDK overlay restores focus to the More
   * button trigger, but the key manager's active item points at the newly
   * selected tab (set during `ngAfterContentChecked`). Realign the key manager
   * to the trigger so the next arrow key behaves relative to where focus is.
   */
  protected onOverflowMenuClosed() {
    const moreButton = this.moreButton();
    if (moreButton) {
      this.keyManager()?.updateActiveItem(moreButton);
    }
  }

  /**
   * After content is checked, the tab group knows what tabs are defined and which index
   * should be currently selected.
   */
  ngAfterContentChecked(): void {
    const indexToSelect = this._clampTabIndex(this.selectedIndex());
    this.selectedIndex.set(indexToSelect);

    if (this._selectedIndex() != indexToSelect) {
      const isFirstRun = this._selectedIndex() == null;

      if (!isFirstRun) {
        this.selectedTabChange.emit({
          index: indexToSelect,
          tab: this.tabs()[indexToSelect],
        });
      }

      // These values need to be updated after change detection as
      // the checked content may have references to them.
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.resolve().then(() => {
        this.tabs().forEach((tab, index) => tab.isActive.set(index === indexToSelect));
        this._initialized.set(true);
      });

      this._selectedIndex.set(indexToSelect);
      this.keyManager()?.setActiveItem(indexToSelect);
    }
  }

  ngAfterViewInit(): void {
    const km = new FocusKeyManager(this.tabLabels, this.injector)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd()
      // Skip disabled items and anything the overflow directive hid via [hidden]
      // (overflowed tabs as well as the More button when there's nothing to surface).
      .skipPredicate((item) => item.disabled || item.elementRef.nativeElement.hidden);

    km.updateActiveItem(this._selectedIndex() ?? 0);

    this.keyManager.set(km);
  }

  private _clampTabIndex(index: number): number {
    return Math.min(this.tabs().length - 1, Math.max(index || 0, 0));
  }
}

export interface BitTabChangeEvent {
  /** The currently selected tab index */
  index: number;
  /** The currently selected tab */
  tab: TabComponent;
}
