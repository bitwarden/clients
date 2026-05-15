import { FocusableOption } from "@angular/cdk/a11y";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions, RouterLinkActive, RouterModule } from "@angular/router";

import { BerryComponent } from "../../berry";
import { IconModule } from "../../icon";
import { OverflowItemDirective } from "../../overflow-list";
import type { BitwardenIcon } from "../../shared/icon";
import { TAB_LABEL_CONTENT_CLASSES, TabListItemDirective } from "../shared/tab-list-item.directive";

import { TabNavBarComponent } from "./tab-nav-bar.component";

@Component({
  selector: "bit-tab-link",
  templateUrl: "tab-link.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  // OverflowItemDirective is registered on the host element so the parent
  // bitOverflowList can discover this tab-link as one of its items.
  hostDirectives: [OverflowItemDirective],
  host: {
    class: "tw-block",
    "[class]":
      "overflowItem.shouldShrink() ? 'tw-flex-1 tw-min-w-0 tw-overflow-hidden' : 'tw-shrink-0'",
  },
  imports: [TabListItemDirective, RouterModule, BerryComponent, IconModule],
})
export class TabLinkComponent implements FocusableOption, AfterViewInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;
  private readonly destroyRef = inject(DestroyRef);
  readonly elementRef = inject(ElementRef);

  /** The OverflowItemDirective attached via hostDirectives. Public so the parent
   *  nav-bar can collect items from its `contentChildren(TabLinkComponent)` query
   *  and forward them to `[bitOverflowList]`. */
  readonly overflowItem = inject(OverflowItemDirective, { host: true });

  readonly tabItem = viewChild.required(TabListItemDirective);
  readonly routerLinkActive = viewChild.required<RouterLinkActive>("rla");
  private readonly labelText = viewChild<ElementRef>("labelText");

  /** Display text for the overflow menu. Uses `label` input if provided, otherwise reads projected text content. */
  readonly displayText = computed(
    () => this.label() ?? this.labelText()?.nativeElement.textContent?.trim() ?? "",
  );

  readonly routerLinkMatchOptions: IsActiveMatchOptions = {
    queryParams: "ignored",
    matrixParams: "ignored",
    paths: "subset",
    fragment: "ignored",
  };

  readonly route = input<string | any[]>();
  readonly label = input<string>();
  readonly berryValue = input<number>();
  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();

  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled = false;

  /** Reactive mirror of RouterLinkActive.isActive — used by TabNavBarComponent for overflow computation. */
  readonly isActive = signal(false);

  /** Roving tabindex value — parent nav-bar sets one link to 0 and the rest to -1. */
  readonly tabIndex = signal(-1);

  @HostListener("keydown", ["$event"]) onKeyDown(event: KeyboardEvent) {
    if (event.code === "Space") {
      this.tabItem().click();
    }
  }

  constructor(private readonly _tabNavBar: TabNavBarComponent) {
    // Pin the active tab so the parent list keeps it visible during overflow.
    effect(() => {
      this.overflowItem.pinned.set(this.isActive());
    });
  }

  focus(): void {
    this.tabItem().focus();
  }

  ngAfterViewInit() {
    const rla = this.routerLinkActive();
    // Seed the signal with the current router state before any change fires
    this.isActive.set(rla.isActive);

    // The active state of tab links are tracked via the routerLinkActive directive
    // We need to watch for changes to tell the parent nav group when the tab is active
    rla.isActiveChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((active) => {
      this.isActive.set(active);
      this._tabNavBar.updateActiveLink();
    });
  }
}
