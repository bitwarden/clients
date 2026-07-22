import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavigationModule } from "./navigation.module";
import { SideNavService } from "./side-nav.service";

@Component({
  imports: [NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-side-nav>
      <bit-nav-logo [openIcon]="logo" route="." label="Home"></bit-nav-logo>
      <bit-nav-group text="Tools" icon="bwi-wrench" [open]="true">
        <span slot="start">LEADING</span>
        <bit-nav-item text="Child A" route="a"></bit-nav-item>
        <bit-nav-item text="Child B" route="b"></bit-nav-item>
        <span slot="end">TRAILING</span>
      </bit-nav-group>
    </bit-side-nav>
  `,
})
class HostComponent {
  logo = { type: "image/svg+xml" as const, content: "<svg data-testid='logo-svg'></svg>" };
}

// Regression: duplicating `<ng-content>` across the side-nav version `@if`/`@else` branches broke
// projection in v1 — nav-group children rendered into an empty slot and `bit-nav-logo` (a selector
// present only in the v2 branch) was dropped entirely. Each slot must appear once in the template.
describe("side-nav v1 content projection", () => {
  let fixture: ComponentFixture<HostComponent>;
  let sideNavService: SideNavService;
  let vfo1Enabled: BehaviorSubject<boolean>;

  beforeEach(async () => {
    vfo1Enabled = new BehaviorSubject<boolean>(false);

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
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: () => vfo1Enabled.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    sideNavService = TestBed.inject(SideNavService);
  });

  it("renders in version 1 by default", () => {
    fixture.detectChanges();
    expect(sideNavService.version()).toBe("1");
  });

  it("projects nav-group child items when side nav is open and group is open", () => {
    sideNavService.open.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("Child A");
    expect(text).toContain("Child B");
  });

  it("projects nav-item [slot=end] trailing content in v1", () => {
    sideNavService.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain("TRAILING");
  });

  // In v1 the collapse button carries the aria state, so the row itself must NOT render the
  // attributes — an undefined [attr.*] binding removes the attribute rather than emitting an empty one.
  it("does not render aria-expanded/aria-controls on the row in v1", () => {
    sideNavService.open.set(true);
    fixture.detectChanges();

    const interactive = fixture.nativeElement.querySelector("[data-testid='nav-item-interactive']");
    expect(interactive?.hasAttribute("aria-expanded")).toBe(false);
    expect(interactive?.hasAttribute("aria-controls")).toBe(false);
  });

  it("projects the bit-nav-logo in v1", () => {
    sideNavService.open.set(true);
    fixture.detectChanges();

    const logo = fixture.nativeElement.querySelector("bit-nav-logo");
    expect(logo).not.toBeNull();
    // The <bit-nav-logo> element exists in light DOM regardless; assert it is actually
    // placed inside the rendered <nav> (i.e. projected into a live <ng-content>).
    const nav = fixture.nativeElement.querySelector("nav#bit-side-nav");
    expect(nav?.contains(logo)).toBe(true);
  });

  // Regression: nav-item declared a separate `<ng-content select="[slot=end]">` in each version
  // branch, so projected [slot=end] content bound to the v1 instance and rendered empty in v2.
  it("projects nav-item [slot=end] trailing content in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain("TRAILING");
  });

  // In v1 the collapse toggle owns the nav-group start slot, so consumer [slot=start] content
  // has no outlet and must not render.
  it("does not project nav-group [slot=start] content in v1", () => {
    sideNavService.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).not.toContain("LEADING");
  });

  // In v2 top-level groups the toggle moves to the end slot, freeing the start slot to forward
  // consumer leading content (e.g. a bit-icon-tile).
  it("projects nav-group [slot=start] content in v2 top-level groups", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain("LEADING");
  });

  it("renders the nav-group collapse arrow in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const arrow = fixture.nativeElement.querySelector("[data-testid='nav-group-collapse-arrow']");
    expect(arrow).not.toBeNull();
  });

  // In v2 the top-level chevron is decorative, so aria-expanded/aria-controls live on the
  // interactive row element instead of a dedicated toggle button.
  it("exposes aria-expanded/aria-controls on the top-level row in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const interactive = fixture.nativeElement.querySelector("[data-testid='nav-item-interactive']");
    expect(interactive?.getAttribute("aria-expanded")).toBe("true");
    expect(interactive?.getAttribute("aria-controls")).toBeTruthy();
  });
});
