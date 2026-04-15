import { FocusableOption } from "@angular/cdk/a11y";
import { NgTemplateOutlet } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  DestroyRef,
  ElementRef,
  HostListener,
  Input,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions, RouterLinkActive, RouterModule } from "@angular/router";

import { BerryComponent } from "../../berry";
import { IconModule } from "../../icon";
import type { BitwardenIcon } from "../../shared/icon";
import { TabLabelDirective } from "../shared/tab-label.directive";
import { TabListItemDirective } from "../shared/tab-list-item.directive";
import { TAB_LABEL_CONTENT_CLASSES } from "../shared/tab-utils";

import { TabNavBarComponent } from "./tab-nav-bar.component";

@Component({
  selector: "bit-tab-link",
  templateUrl: "tab-link.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-inline-flex tw-items-center",
  },
  imports: [TabListItemDirective, RouterModule, BerryComponent, IconModule, NgTemplateOutlet],
})
export class TabLinkComponent implements FocusableOption, AfterViewInit {
  protected readonly tabLabelContentClasses = TAB_LABEL_CONTENT_CLASSES;
  private readonly destroyRef = inject(DestroyRef);
  readonly elementRef = inject(ElementRef);

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
  readonly trailingIcon = input<BitwardenIcon>();

  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ContentChild(TabLabelDirective) templateLabel?: TabLabelDirective;

  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled = false;

  /** Reactive mirror of RouterLinkActive.isActive — used by TabNavBarComponent for overflow computation. */
  readonly isActive = signal(false);

  /** Determines whether to truncate the tab label when this is the active tab and space is constrained. */
  readonly truncate = signal(false);

  @HostListener("keydown", ["$event"]) onKeyDown(event: KeyboardEvent) {
    if (event.code === "Space") {
      this.tabItem().click();
    }
  }

  get active() {
    return this.isActive();
  }

  constructor(private readonly _tabNavBar: TabNavBarComponent) {}

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
