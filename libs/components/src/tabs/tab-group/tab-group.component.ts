import { FocusKeyManager } from "@angular/cdk/a11y";
import { coerceNumberProperty } from "@angular/cdk/coercion";
import { NgTemplateOutlet } from "@angular/common";
import {
  AfterContentChecked,
  AfterViewInit,
  Component,
  Input,
  afterNextRender,
  contentChild,
  contentChildren,
  effect,
  input,
  output,
  viewChild,
  viewChildren,
  inject,
  DestroyRef,
  ElementRef,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";

import { BerryComponent } from "../../berry";
import { IconModule } from "../../icon";
import { MenuModule } from "../../menu";
import { TabHeaderComponent } from "../shared/tab-header.component";
import {
  TabListContainerDirective,
  tabListContainerGap,
} from "../shared/tab-list-container.directive";
import { TabListItemDirective } from "../shared/tab-list-item.directive";

import { TabBodyComponent } from "./tab-body.component";
import { TabComponent } from "./tab.component";

/** Used to generate unique ID's for each tab component */
let nextId = 0;

@Component({
  selector: "bit-tab-group",
  templateUrl: "./tab-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TabHeaderComponent,
    TabListContainerDirective,
    TabListItemDirective,
    TabBodyComponent,
    BerryComponent,
    IconModule,
    MenuModule,
  ],
})
export class TabGroupComponent implements AfterContentChecked, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly resizeObserver: ResizeObserver;

  private readonly _groupId: number;
  private readonly _indexToSelect = signal<number | null>(0);

  /**
   * Aria label for the tab list menu
   */
  readonly label = input("");

  /**
   * Keep the content of off-screen tabs in the DOM.
   * Useful for keeping <audio> or <video> elements from re-initializing
   * after navigating between tabs.
   */
  readonly preserveContent = input(false);

  /** Error if no `TabComponent` is supplied. (`contentChildren`, used to query for all the tabs, doesn't support `required`) */
  private readonly _tab = contentChild.required(TabComponent);

  protected readonly tabs = contentChildren(TabComponent);
  readonly tabLabels = viewChildren(TabListItemDirective);

  private readonly tabHeader = viewChild.required(TabHeaderComponent, { read: ElementRef });
  private readonly tabHeaderWidth = signal(0);

  private readonly moreButton = viewChild.required<ElementRef>("moreButton");

  /** Cached tab widths measured before any hiding, keyed by index. */
  private readonly tabWidths = signal<number[]>([]);

  /** Cached More button width measured before any hiding. */
  private readonly moreButtonWidth = signal(0);

  /** Whether the tab list has been rendered. Used to hide or display tab list container, preventing layout shifts. */
  protected readonly tabListRendered = signal(false);

  /** Determines the index at which tabs start overflowing into the "More" menu. */
  protected readonly overflowTabIndex = computed(() => {
    if (!this.tabListRendered()) {
      return undefined;
    }
    const containerWidth = this.tabHeaderWidth();

    const totalTabsWidth = this.tabWidths().reduce(
      (sum, w, i) => sum + w + (i > 0 ? tabListContainerGap : 0),
      0,
    );

    // If all tabs fit without the more button, no overflow needed
    if (totalTabsWidth <= containerWidth) {
      return undefined;
    }

    // Tabs overflow — reserve space for the more button and find the cutoff index
    const availableWidth = containerWidth - this.moreButtonWidth(); // Add extra buffer to prevent edge case overflow when button width is close to available space
    let totalWidth = 0;
    const tabWidths = this.tabWidths();
    for (let i = 0; i < tabWidths.length; i++) {
      totalWidth += tabWidths[i] + (i > 0 ? tabListContainerGap : 0);
      if (totalWidth > availableWidth) {
        return i;
      }
    }

    return undefined;
  });

  /** The index of the active tab. */
  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get selectedIndex(): number | null {
    return this._selectedIndex();
  }
  set selectedIndex(value: number) {
    this._indexToSelect.set(coerceNumberProperty(value, null));
  }
  private readonly _selectedIndex = signal<number | null>(null);

  /** Output to enable support for two-way binding on `[(selectedIndex)]` */
  readonly selectedIndexChange = output<number>();

  /** Event emitted when the tab selection has changed. */
  readonly selectedTabChange = output<BitTabChangeEvent>();

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  readonly keyManager = signal<FocusKeyManager<TabListItemDirective> | undefined>(undefined);

  constructor() {
    this._groupId = nextId++;
    this.resizeObserver = new ResizeObserver(this.measureTabHeaderWidth);

    afterNextRender(() => {
      // Measure tab widths and more button width after fonts have loaded to ensure accurate measurements
      void document.fonts.ready.then(() => {
        this.measureMoreButtonWidth();
        this.measureTabWidths();
        this.tabListRendered.set(true);
      });
      this.resizeObserver.observe(this.tabHeader().nativeElement);
      this.destroyRef.onDestroy(() => this.resizeObserver.disconnect());
    });

    effect(() => {
      const indexToSelect = this._clampTabIndex(this._indexToSelect() ?? 0);

      // If the selected tab didn't explicitly change, keep the previously
      // selected tab selected/active
      if (indexToSelect === this._selectedIndex()) {
        const tabs = this.tabs();
        let selectedTab: TabComponent | undefined;

        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i].isActive()) {
            // Set both _indexToSelect and _selectedIndex to avoid firing a change
            // event which could cause an infinite loop if adding a tab within the
            // selectedIndexChange event
            this._indexToSelect.set(i);
            this._selectedIndex.set(i);
            selectedTab = tabs[i];
            break;
          }
        }

        // No active tab found and a tab does exist means the active tab
        // was removed, so a new active tab must be set manually
        if (!selectedTab && tabs[indexToSelect]) {
          tabs[indexToSelect].isActive.set(true);
          this.selectedTabChange.emit({
            index: indexToSelect,
            tab: tabs[indexToSelect],
          });
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
    this.selectedIndex = index;
  }

  /**
   * After content is checked, the tab group knows what tabs are defined and which index
   * should be currently selected.
   */
  ngAfterContentChecked(): void {
    const indexToSelect = this._clampTabIndex(this._indexToSelect() ?? 0);
    this._indexToSelect.set(indexToSelect);

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

        if (!isFirstRun) {
          this.selectedIndexChange.emit(indexToSelect);
        }
      });

      // Manually update the _selectedIndex and keyManager active item
      this._selectedIndex.set(indexToSelect);
      this.keyManager()?.setActiveItem(indexToSelect);
    }
  }

  ngAfterViewInit(): void {
    this.keyManager.set(
      new FocusKeyManager(this.tabLabels())
        .withHorizontalOrientation("ltr")
        .withWrap()
        .withHomeAndEnd()
        // Skip disabled and hidden tabs to allow focus to move to "More" button on keyboard navigation
        .skipPredicate((item) => item.disabled || item.elementRef.nativeElement.hidden),
    );
  }

  private _clampTabIndex(index: number): number {
    return Math.min(this.tabs().length - 1, Math.max(index || 0, 0));
  }

  /**
   * Calculates and sets the width of the tab header
   */
  private readonly measureTabHeaderWidth = (entries?: ResizeObserverEntry[]) => {
    const headerEl = this.tabHeader().nativeElement;
    const contentWidth = entries
      ? entries[0].contentBoxSize[0].inlineSize
      : headerEl.getBoundingClientRect().width;

    if (contentWidth !== this.tabHeaderWidth()) {
      this.tabHeaderWidth.set(contentWidth);
    }
  };

  /**
   * Measures the widths of all the tabs and stores them in the `tabWidths` signal.
   * This is used to determine how many tabs can fit in the available space before
   * overflowing into the "More" menu.
   */
  private readonly measureTabWidths = () => {
    this.tabWidths.set(
      this.tabLabels()
        // Exclude the More button (last item) — it's measured separately
        .slice(0, -1)
        // Round up to prevent edge case overflow when tab width is close to available space
        .map((tab) => Math.ceil(tab.elementRef.nativeElement.getBoundingClientRect().width)),
    );
  };

  /**
   * Measures the width of the "More" button and stores it in the `moreButtonWidth` signal.
   * This is used to determine how many tabs can fit in the available space before
   * overflowing into the "More" menu.
   */
  private readonly measureMoreButtonWidth = (entries?: ResizeObserverEntry[]): void => {
    const moreButtonEl = this.moreButton().nativeElement;
    if (!moreButtonEl) {
      this.moreButtonWidth.set(0);
      return;
    }

    if (entries != null) {
      // Called by ResizeObserver — button is visible, read directly from entries
      this.moreButtonWidth.set(entries[0].contentBoxSize[0].inlineSize + tabListContainerGap);
      return;
    }

    // Called manually (init / fonts loaded) — button may be hidden, temporarily show it
    const wasHidden = moreButtonEl.hidden;
    if (wasHidden) {
      moreButtonEl.hidden = false;
      // Force style recalculation before measuring, as getBoundingClientRect()
      // may return stale dimensions if styles haven't been flushed yet.
      void window.getComputedStyle(moreButtonEl).width;
    }

    this.moreButtonWidth.set(moreButtonEl.getBoundingClientRect().width + tabListContainerGap);

    // Hide the more button again if it was originally hidden
    if (wasHidden) {
      moreButtonEl.hidden = true;
    }
  };
}

export interface BitTabChangeEvent {
  /**
   * The currently selected tab index
   */
  index: number;
  /**
   * The currently selected tab
   */
  tab: TabComponent;
}
