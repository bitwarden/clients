import { FocusKeyManager } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  contentChildren,
  effect,
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
import { TabHeaderComponent } from "../shared/tab-header.component";
import { TabListContainerDirective } from "../shared/tab-list-container.directive";
import { TabListItemDirective } from "../shared/tab-list-item.directive";
import {
  TAB_LABEL_CONTENT_CLASSES,
  computeTabOverflow,
  measureMoreButtonWidth,
  measureTabWidths,
} from "../shared/tab-utils";

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
  ],
})
export class TabNavBarComponent implements AfterContentInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly resizeObserver: ResizeObserver;

  private readonly tabHeader = viewChild.required(TabHeaderComponent, { read: ElementRef });
  private readonly moreButton = viewChild.required<ElementRef>("moreButton");

  readonly tabLabels = contentChildren(forwardRef(() => TabLinkComponent));
  readonly label = input("");

  private readonly tabHeaderWidth = signal(0);

  /** Cached tab widths measured before any hiding, keyed by index. */
  private readonly tabWidths = signal<number[]>([]);

  /** Cached More button width measured before any hiding. */
  private readonly moreButtonWidth = signal(0);

  /** Whether the tab list has been rendered. Used to hide or display tab list container, preventing layout shifts. */
  protected readonly tabListRendered = signal(false);

  /** Determines which tabs are displayed and which overflow into the "More" menu. */
  protected readonly sortedTabs = computed(() => {
    const activeIndex = this.tabLabels().findIndex((t) => t.isActive());
    return computeTabOverflow(
      this.tabLabels().length,
      this.tabListRendered(),
      this.tabWidths(),
      this.tabHeaderWidth(),
      this.moreButtonWidth(),
      activeIndex === -1 ? 0 : activeIndex,
    );
  });

  /**
   * Focus key manager for keeping tab controls accessible.
   * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/tablist_role#keyboard_interactions
   */
  readonly keyManager = signal<FocusKeyManager<TabLinkComponent> | undefined>(undefined);

  constructor() {
    this.resizeObserver = new ResizeObserver((entries) =>
      this.tabHeaderWidth.set(entries[0].contentBoxSize[0].inlineSize),
    );

    afterNextRender(() => {
      // Measure tab widths and more button width after fonts have loaded to ensure accurate measurements
      void document.fonts.ready.then(() => {
        this.moreButtonWidth.set(measureMoreButtonWidth(this.moreButton().nativeElement));
        this.tabWidths.set(
          measureTabWidths(this.tabLabels().map((tab) => tab.elementRef.nativeElement)),
        );
        this.tabListRendered.set(true);
      });
      this.resizeObserver.observe(this.tabHeader().nativeElement);
      this.destroyRef.onDestroy(() => this.resizeObserver.disconnect());
    });

    // Hide/show tab link host elements based on overflow computation
    effect(() => {
      const { displayed, truncateTabIndex } = this.sortedTabs();
      const displayedSet = new Set(displayed);
      this.tabLabels().forEach((tab, i) => {
        tab.elementRef.nativeElement.hidden = !displayedSet.has(i);
        const shouldTruncate = i === truncateTabIndex;
        tab.truncate.set(shouldTruncate);
        tab.elementRef.nativeElement.classList.toggle("tw-flex-1", shouldTruncate);
        tab.elementRef.nativeElement.classList.toggle("tw-overflow-hidden", shouldTruncate);
      });
    });
  }

  ngAfterContentInit(): void {
    const km = new FocusKeyManager(this.tabLabels, this.injector)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd()
      .skipPredicate((item) => item.disabled);

    this.keyManager.set(km);
  }

  updateActiveLink() {
    // Keep the keyManager in sync with active tabs
    const items = this.tabLabels();
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) {
        this.keyManager()?.updateActiveItem(i);
      }
    }
  }
}
