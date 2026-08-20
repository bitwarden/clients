import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterModule } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { IconTileComponent } from "../icon-tile";
import { I18nMockService } from "../utils/i18n-mock.service";
import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { NavGroupComponent } from "./nav-group.component";
import { NavigationModule } from "./navigation.module";
import { SideNavService } from "./side-nav.service";

@Component({
  imports: [NavigationModule, IconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-side-nav>
      <bit-nav-logo [openIcon]="logo" route="." label="Home"></bit-nav-logo>
      <bit-nav-group text="Tools" icon="bwi-wrench" [open]="true">
        <span slot="start">LEADING</span>
        <bit-nav-item text="Child A" route="a"></bit-nav-item>
        <bit-nav-item text="Child B" route="b"></bit-nav-item>
        <button slot="end" type="button" data-testid="end-action" (click)="endActionClicked = true">
          Edit
        </button>
        <span slot="end">TRAILING</span>
      </bit-nav-group>
      <bit-nav-group text="Vault" [route]="['v']" [open]="true">
        <bit-icon-tile icon="bwi-star" data-testid="rail-tile"></bit-icon-tile>
        <bit-nav-item text="Child C" route="c"></bit-nav-item>
        <bit-nav-group text="Nested" [route]="['n']" [open]="true">
          <bit-nav-item text="Child D" route="d"></bit-nav-item>
        </bit-nav-group>
      </bit-nav-group>
    </bit-side-nav>
  `,
})
class HostComponent {
  logo = { type: "image/svg+xml" as const, content: "<svg data-testid='logo-svg'></svg>" };
  endActionClicked = false;
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

  it("renders the default nav version by default", () => {
    fixture.detectChanges();
    expect(sideNavService.version()).toBe("default");
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

  it("projects the bit-nav-logo into the header row in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const logo = fixture.nativeElement.querySelector("bit-nav-logo");
    expect(logo).not.toBeNull();

    const header = fixture.nativeElement.querySelector("[data-testid='side-nav-header']");
    const body = fixture.nativeElement.querySelector("[data-testid='side-nav-body']");
    expect(header?.contains(logo)).toBe(true);
    expect(body?.contains(logo)).toBe(false);
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

  // Regression: a v2 nav-group whose only leading glyph is a projected [slot=start] tile (no `icon`
  // input) disappeared entirely from the collapsed rail. The tile must stay as the rail glyph, and
  // live inside the interactive element so it is a real click target (not an overlay).
  it("keeps the start-slot tile inside the interactive element on the collapsed rail in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(false);
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector("[data-testid='rail-tile']");
    expect(tile).not.toBeNull();
    expect(tile.closest("[data-testid='nav-item-interactive']")).not.toBeNull();
  });

  it("renders the start-slot tile inside the interactive element when open in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector("[data-testid='rail-tile']");
    expect(tile).not.toBeNull();
    expect(tile.closest("[data-testid='nav-item-interactive']")).not.toBeNull();
  });

  // The tile ng-content is stamped once inside the interactive element (not moved between two
  // positions), so it survives repeated open/collapse toggles.
  it("keeps the start-slot tile across open->collapse->open toggles in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();
    sideNavService.open.set(false);
    fixture.detectChanges();
    sideNavService.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("[data-testid='rail-tile']")).not.toBeNull();
  });

  // The tile is matched by its `bit-icon-tile` selector, not `slot="start"` — a forwarded tile with
  // no slot attribute must still route into the group's interactive row.
  it("routes a slot-less bit-icon-tile into the interactive element in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const tile = fixture.nativeElement.querySelector("[data-testid='rail-tile']");
    expect(tile).not.toBeNull();
    expect(tile.closest("[data-testid='nav-item-interactive']")).not.toBeNull();
  });

  // The forwarded tile is the group's own leading glyph — it must not fall through into the group's
  // expandable child-item region (`role="group"`).
  it("does not render the forwarded tile among the group's child items in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const submenus = fixture.nativeElement.querySelectorAll("[role='group']");
    submenus.forEach((submenu: HTMLElement) => {
      expect(submenu.querySelector("[data-testid='rail-tile']")).toBeNull();
    });
  });

  // A nested group's collapse toggle also uses [slot=start], but a <button> must never nest inside
  // the interactive <a>/<button>. It must render as a sibling, outside the interactive element.
  it("renders a nested group's start-slot collapse toggle outside the interactive element in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const toggles = fixture.nativeElement.querySelectorAll(
      "button[data-testid='nav-group-collapse-arrow']",
    );
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((toggle: HTMLElement) => {
      expect(toggle.closest("[data-testid='nav-item-interactive']")).toBeNull();
    });
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

  // The v2 top-level chevron is decorative and sits in the trailing `end` slot, a sibling of the
  // interactive row. Clicking it must behave like clicking the row and toggle the group.
  it("toggles a v2 top-level group when its decorative collapse chevron is clicked", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const toolsGroup = fixture.debugElement
      .queryAll(By.directive(NavGroupComponent))
      .find((de) => de.componentInstance.text() === "Tools")!;
    expect(toolsGroup.componentInstance.open()).toBe(true);

    const chevron = toolsGroup.nativeElement.querySelector(
      "bit-icon[data-testid='nav-group-collapse-arrow']",
    ) as HTMLElement;
    expect(chevron).not.toBeNull();

    chevron.click();
    fixture.detectChanges();

    expect(toolsGroup.componentInstance.open()).toBe(false);
  });

  // The `end` slot is an interactive island only when it holds a control: clicking a projected
  // button runs its own action without toggling the group.
  it("does not toggle the group when an interactive end-slot control is clicked in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const toolsGroup = fixture.debugElement
      .queryAll(By.directive(NavGroupComponent))
      .find((de) => de.componentInstance.text() === "Tools")!;
    expect(toolsGroup.componentInstance.open()).toBe(true);

    const button = toolsGroup.nativeElement.querySelector(
      "button[data-testid='end-action']",
    ) as HTMLElement;
    expect(button).not.toBeNull();

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.endActionClicked).toBe(true);
    expect(toolsGroup.componentInstance.open()).toBe(true);
  });
});

// Mirrors the app-level wrappers (`apps/web/src/app/layouts/web-side-nav.component.html`,
// `apps/desktop/src/app/layout/desktop-side-nav.component.html`): no app declares
// `<bit-nav-logo>` directly inside `<bit-side-nav>`, it always arrives re-projected.
@Component({
  selector: "app-test-side-nav",
  imports: [NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-side-nav>
      <ng-content select="bit-nav-logo" ngProjectAs="bit-nav-logo"></ng-content>
      <ng-content></ng-content>
    </bit-side-nav>
  `,
})
class WrapperComponent {}

@Component({
  imports: [NavigationModule, WrapperComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-test-side-nav>
      <bit-nav-logo [openIcon]="logo" route="." label="Home"></bit-nav-logo>
      <bit-nav-item text="Child A" route="a"></bit-nav-item>
    </app-test-side-nav>
  `,
})
class WrapperHostComponent {
  logo = { type: "image/svg+xml" as const, content: "<svg data-testid='logo-svg'></svg>" };
}

// Regression: Angular matches the `<ng-content>` node itself against the inner component's
// selectors, not the nodes flowing through it. A wrapper forwarding with a bare `<ng-content>`
// drops the logo into `bit-side-nav`'s wildcard slot — which v2 renders in the nav body, not the
// header row. The wrapper must forward the named slot with `ngProjectAs`.
describe("side-nav content projection through a wrapper component", () => {
  let fixture: ComponentFixture<WrapperHostComponent>;
  let sideNavService: SideNavService;
  let vfo1Enabled: BehaviorSubject<boolean>;

  beforeEach(async () => {
    vfo1Enabled = new BehaviorSubject<boolean>(false);

    await TestBed.configureTestingModule({
      imports: [WrapperHostComponent, RouterModule.forRoot([])],
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

    fixture = TestBed.createComponent(WrapperHostComponent);
    sideNavService = TestBed.inject(SideNavService);
  });

  it("projects a re-projected bit-nav-logo into the header row in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const logo = fixture.nativeElement.querySelector("bit-nav-logo");
    expect(logo).not.toBeNull();

    const header = fixture.nativeElement.querySelector("[data-testid='side-nav-header']");
    const body = fixture.nativeElement.querySelector("[data-testid='side-nav-body']");
    expect(header?.contains(logo)).toBe(true);
    expect(body?.contains(logo)).toBe(false);
  });

  it("keeps wildcard-slot content out of the header row in v2", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector("[data-testid='side-nav-body']");
    const header = fixture.nativeElement.querySelector("[data-testid='side-nav-header']");
    expect(body?.textContent as string).toContain("Child A");
    expect(header?.textContent as string).not.toContain("Child A");
  });

  it("projects a re-projected bit-nav-logo inside the nav in v1", () => {
    sideNavService.open.set(true);
    fixture.detectChanges();

    const logo = fixture.nativeElement.querySelector("bit-nav-logo");
    expect(logo).not.toBeNull();
    const nav = fixture.nativeElement.querySelector("nav#bit-side-nav");
    expect(nav?.contains(logo)).toBe(true);
  });

  it("does not duplicate the re-projected logo across slots", () => {
    vfo1Enabled.next(true);
    sideNavService.open.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll("bit-nav-logo").length).toBe(1);
  });
});
