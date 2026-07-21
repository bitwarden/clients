import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconTileComponent, IconTileSize } from "../icon-tile";
import { OverflowItemDirective } from "../overflow-list";
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
      <bit-breadcrumb route="/vault">
        <bit-icon-tile slot="start" icon="bwi-vault" />
        Vault
      </bit-breadcrumb>
    </bit-breadcrumbs>
  `,
  imports: [BreadcrumbsComponent, BreadcrumbComponent, IconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly size = signal<"small" | "base">("base");
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

  /** The overflow-item wrapper span that gates the crumb's shrink/truncate behavior. */
  function crumbWrapper(): { element: HTMLElement; item: OverflowItemDirective } {
    const debugEl = fixture.debugElement.query(By.directive(OverflowItemDirective));
    return {
      element: debugEl.nativeElement as HTMLElement,
      item: debugEl.injector.get(OverflowItemDirective),
    };
  }

  it("keeps the crumb from shrinking by default", () => {
    fixture.detectChanges();

    const { element } = crumbWrapper();
    expect(element.classList).toContain("tw-shrink-0");
    expect(element.classList).not.toContain("tw-flex-1");
  });

  it("lets the crumb shrink and truncate once it is the lone displayed item", () => {
    fixture.detectChanges();

    const { element, item } = crumbWrapper();
    item.shouldShrink.set(true);
    fixture.detectChanges();

    expect(element.classList).toContain("tw-flex-1");
    expect(element.classList).toContain("tw-min-w-0");
    expect(element.classList).toContain("tw-overflow-hidden");
    expect(element.classList).not.toContain("tw-shrink-0");
  });
});
