import { FocusKeyManager } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  AfterContentChecked,
  AfterViewInit,
  Component,
  afterNextRender,
  contentChild,
  contentChildren,
  effect,
  input,
  model,
  output,
  viewChild,
  viewChildren,
  inject,
  DestroyRef,
  ElementRef,
  Injector,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BerryComponent } from "../../berry";
import { IconModule } from "../../icon";
import { MenuModule } from "../../menu";
import { TabHeaderComponent } from "../shared/tab-header.component";
import { TabListContainerDirective } from "../shared/tab-list-container.directive";
import { TabListItemDirective } from "../shared/tab-list-item.directive";
import {
  TAB_LABEL_CONTENT_CLASSES,
  computeTabOverflow,
  measureMoreButtonWidth,
  measureTabWidths,
} from "../shared/tab-utils";

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
    I18nPipe,
  ],
})
export class TabGroupComponent implements AfterContentChecked, AfterViewInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;

  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly resizeObserver: ResizeObserver;

  private readonly _groupId: number;

  /**
   * Aria label for the tab list menu
   */
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

  private readonly tabHeader = viewChild.required(TabHeaderComponent, { read: ElementRef });
  private readonly tabHeaderWidth = signal(0);

  private readonly moreButton = viewChild.required<ElementRef>("moreButton");

  /** Cached tab widths measured before any hiding, keyed by index. */
  private readonly tabWidths = signal<number[]>([]);

  /** Cached More button width measured before any hiding. */
  private readonly moreButtonWidth = signal(0);

  /** Whether the tab list has been rendered. Used to hide or display tab list container, preventing layout shifts. */
  protected readonly tabListRendered = signal(false);

  /** Determines which tabs are displayed and which overflow into the "More" menu. */
  protected readonly sortedTabs = computed(() =>
    computeTabOverflow(
      this.tabs().length,
      this.tabListRendered(),
      this.tabWidths(),
      this.tabHeaderWidth(),
      this.moreButtonWidth(),
      this.selectedIndex(),
    ),
  );

  /** The index of the active tab. Supports two-way binding via `[(selectedIndex)]`. */
  readonly selectedIndex = model(0);

  private readonly _selectedIndex = signal<number | null>(null);

  /** Event emitted when the tab selection has changed. */
  readonly selectedTabChange = output<BitTabChangeEvent>();

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  readonly keyManager = signal<FocusKeyManager<TabListItemDirective> | undefined>(undefined);

  constructor() {
    this._groupId = nextId++;
    this.resizeObserver = new ResizeObserver((entries) =>
      this.tabHeaderWidth.set(entries[0].contentBoxSize[0].inlineSize),
    );

    afterNextRender(() => {
      // Measure tab widths and more button width after fonts have loaded to ensure accurate measurements
      void document.fonts.ready.then(() => {
        this.moreButtonWidth.set(measureMoreButtonWidth(this.moreButton().nativeElement));
        this.tabWidths.set(
          measureTabWidths(
            this.tabLabels()
              // Exclude the More button (last item) — it's measured separately
              .slice(0, -1)
              .map((tab) => tab.elementRef.nativeElement),
          ),
        );
        this.tabListRendered.set(true);
      });
      this.resizeObserver.observe(this.tabHeader().nativeElement);
      this.destroyRef.onDestroy(() => this.resizeObserver.disconnect());
    });

    effect(() => {
      const indexToSelect = this._clampTabIndex(this.selectedIndex());

      // If the selected tab didn't explicitly change, keep the previously
      // selected tab selected/active
      if (indexToSelect === this._selectedIndex()) {
        const tabs = this.tabs();
        let selectedTab: TabComponent | undefined;

        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i].isActive()) {
            // Set both selectedIndex and _selectedIndex to avoid firing a change
            // event which could cause an infinite loop if adding a tab within the
            // selectedIndex change event
            this.selectedIndex.set(i);
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
    this.selectedIndex.set(index);
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
      });

      // Manually update the _selectedIndex and keyManager active item
      this._selectedIndex.set(indexToSelect);
      this.keyManager()?.setActiveItem(indexToSelect);
    }
  }

  ngAfterViewInit(): void {
    // Pass the signal (not a snapshot) so the key manager always sees the current set of displayed tabs.
    const km = new FocusKeyManager(this.tabLabels, this.injector)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd()
      // Skip disabled and hidden tabs to allow focus to move to "More" button on keyboard navigation
      .skipPredicate((item) => item.disabled || item.elementRef.nativeElement.hidden);

    // Sync the key manager's active item with the already-selected tab.
    // ngAfterContentChecked (which calls setActiveItem) runs before ngAfterViewInit,
    // so the key manager is always initialized with activeItemIndex = -1 without this.
    km.updateActiveItem(this._selectedIndex() ?? 0);

    this.keyManager.set(km);
  }

  private _clampTabIndex(index: number): number {
    return Math.min(this.tabs().length - 1, Math.max(index || 0, 0));
  }
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
