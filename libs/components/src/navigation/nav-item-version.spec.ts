import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavigationModule } from "./navigation.module";
import { SideNavService, SideNavVersion } from "./side-nav.service";

@Component({
  imports: [NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-side-nav [version]="version()">
      <bit-nav-item text="Top level" route="."></bit-nav-item>
    </bit-side-nav>
  `,
})
class HostComponent {
  readonly version = signal<SideNavVersion>("1");
}

// Regression: the nav-item base indentation padding used to be read once in the constructor. Because
// the version is propagated into the service via an async effect that flushes after child nav items
// are constructed, that read always saw the default "1" — so v2 items kept the v1 base padding.
// The padding must derive reactively from the version signal.
describe("nav-item version-reactive padding", () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, RouterModule.forRoot([])],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              sideNavigation: "Side navigation",
              toggleSideNavigation: "Toggle side navigation",
              resizeSideNavigation: "Resize side navigation",
              toggleCollapse: "Toggle collapse",
              submenu: "submenu",
            }),
        },
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    TestBed.inject(SideNavService).open.set(true);
  });

  function containerPadding(): string {
    const container = fixture.nativeElement.querySelector<HTMLElement>(
      "[data-testid='nav-item-container']",
    );
    return container?.style.paddingInlineStart ?? "";
  }

  it("uses the 2.25rem base padding in version 1", () => {
    fixture.componentInstance.version.set("1");
    fixture.detectChanges();

    expect(containerPadding()).toBe("2.25rem");
  });

  it("uses the 0.5rem base padding in version 2", () => {
    fixture.componentInstance.version.set("2");
    fixture.detectChanges();

    expect(containerPadding()).toBe("0.5rem");
  });

  it("reacts when the version changes after initial render", () => {
    fixture.componentInstance.version.set("1");
    fixture.detectChanges();
    expect(containerPadding()).toBe("2.25rem");

    fixture.componentInstance.version.set("2");
    fixture.detectChanges();
    expect(containerPadding()).toBe("0.5rem");
  });
});
