import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconTileComponent, IconTileSize } from "../icon-tile";
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
});
