import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconTileComponent, IconTileSize } from "../icon-tile";
import { OverflowItemDirective, OverflowListDirective } from "../overflow-list";
import { I18nMockService } from "../utils/i18n-mock.service";

import { BreadcrumbComponent } from "./breadcrumb.component";
import { BreadcrumbsComponent } from "./breadcrumbs.component";

// JSDOM does not implement ResizeObserver — provide a no-op stub so the
// component can construct without throwing.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

@Component({
  template: `
    <bit-breadcrumbs [size]="size()">
      @for (label of labels(); track label; let first = $first) {
        <bit-breadcrumb route="/vault">
          @if (first) {
            <bit-icon-tile slot="start" icon="bwi-vault" />
          }
          {{ label }}
        </bit-breadcrumb>
      }
    </bit-breadcrumbs>
  `,
  imports: [BreadcrumbsComponent, BreadcrumbComponent, IconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly size = signal<"small" | "base">("base");
  /** Breadcrumb labels to render; defaults to a single crumb. */
  readonly labels = signal<string[]>(["Vault"]);
}

describe("BreadcrumbsComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([]),
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              breadcrumbs: "Breadcrumbs",
              moreBreadcrumbs: "More breadcrumbs",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
  });

  /** The `size` the projected icon tile was driven to by the parent breadcrumbs. */
  function tileSize(): IconTileSize {
    const tile = fixture.debugElement.query(By.directive(IconTileComponent))
      .componentInstance as IconTileComponent;
    return tile.size();
  }

  it("sizes a projected start-slot icon tile to `sm` when the breadcrumbs are `base`", () => {
    fixture.componentInstance.size.set("base");
    fixture.detectChanges();

    expect(tileSize()).toBe("sm");
  });

  it("sizes a projected start-slot icon tile to `xs` when the breadcrumbs are `small`", () => {
    fixture.componentInstance.size.set("small");
    fixture.detectChanges();

    expect(tileSize()).toBe("xs");
  });

  it("remeasures the overflow list when `size` flips", async () => {
    // Crumb widths are size-dependent (typography and separator margins both change with
    // `size`), but the directive only remeasures when the item set changes. Without this the
    // row packs against widths captured at the other density — over-collapsing into the menu
    // going small, and clipping instead of truncating going back to base.
    fixture.detectChanges();
    // The directive's first measurement pass awaits `document.fonts.ready`, so let that
    // settle — `remeasure()` no-ops until it lands.
    await fixture.whenStable();

    const list = fixture.debugElement
      .query(By.directive(OverflowListDirective))
      .injector.get(OverflowListDirective);
    expect(list.ready()).toBe(true);

    const remeasure = jest.spyOn(list, "remeasure");

    // `reset` matters because collapsed crumbs stamp no content and would otherwise measure
    // as just their separator arrow — not reproducible here, since JSDOM reports zero for
    // every geometry read.
    fixture.componentInstance.size.set("small");
    fixture.detectChanges();
    expect(remeasure).toHaveBeenCalledTimes(1);
    expect(remeasure).toHaveBeenCalledWith({ reset: true });

    fixture.componentInstance.size.set("base");
    fixture.detectChanges();
    expect(remeasure).toHaveBeenCalledTimes(2);
  });

  /** The overflow-item directives that gate each crumb's shrink/truncate behavior. */
  function crumbItems(): OverflowItemDirective[] {
    return fixture.debugElement
      .queryAll(By.directive(OverflowItemDirective))
      .map((debugEl) => debugEl.injector.get(OverflowItemDirective));
  }

  it("marks a lone crumb as shrinkable so it truncates rather than overflows", () => {
    // A single crumb is the sole displayed item, so it should be allowed to shrink —
    // even though nothing is packed into the overflow menu.
    fixture.detectChanges();

    const [item] = crumbItems();
    expect(item.shouldShrink()).toBe(true);
  });

  it("keeps crumbs from shrinking while more than one is displayed", () => {
    fixture.componentInstance.labels.set(["Vault", "Folder"]);
    fixture.detectChanges();

    for (const item of crumbItems()) {
      expect(item.shouldShrink()).toBe(false);
    }
  });
});
