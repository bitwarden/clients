import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, ReplaySubject } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { HealthOverviewComponent } from "./health-overview.component";
import { HealthComponent } from "./health.component";
import { HealthAccessService } from "./services/health-access.service";

@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupPageComponent {}

@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupHeaderComponent {
  readonly pageTitle = input<string | undefined>(undefined);
}

@Component({
  selector: "app-pop-out",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopOutComponent {}

@Component({
  selector: "app-current-account",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockCurrentAccountComponent {}

/**
 * Stands in for the real overview, which injects the vault-health report
 * service, the cipher service, and the log service. The shell only needs to
 * know that it renders.
 */
@Component({
  selector: "dirt-health-overview",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockHealthOverviewComponent {}

describe("HealthComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthComponent>;
  let activeAccount$: ReplaySubject<Account | null>;
  let hasBeenOpened$: BehaviorSubject<boolean>;
  let hasRunScan$: BehaviorSubject<boolean>;
  let healthAccessService: MockProxy<HealthAccessService>;

  /** Creates the component and flushes the microtask that writes the state. */
  async function initComponent() {
    fixture = TestBed.createComponent(HealthComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The intro view, rendered until the User has run a Health scan. */
  function intro(): HTMLElement | null {
    return fixture.nativeElement.querySelector("health-intro");
  }

  /** The intro view's "Scan my vault" CTA. */
  function scanButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector("health-intro button");
  }

  /** The Health Overview, rendered once the User has run a Health scan. */
  function overview(): HTMLElement | null {
    return fixture.nativeElement.querySelector("dirt-health-overview");
  }

  beforeEach(async () => {
    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    hasBeenOpened$ = new BehaviorSubject<boolean>(false);
    hasRunScan$ = new BehaviorSubject<boolean>(false);

    healthAccessService = mock<HealthAccessService>();
    healthAccessService.healthHasBeenOpened$.mockReturnValue(hasBeenOpened$);
    healthAccessService.hasRunHealthScan$.mockReturnValue(hasRunScan$);

    await TestBed.configureTestingModule({
      imports: [HealthComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: HealthAccessService, useValue: healthAccessService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: AbstractThemingService,
          useValue: { theme$: new BehaviorSubject(ThemeTypes.Light) },
        },
      ],
    })
      .overrideComponent(HealthComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
            HealthOverviewComponent,
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
            MockHealthOverviewComponent,
          ],
        },
      })
      .compileComponents();
  });

  describe("intro view", () => {
    it("shows the intro when the User has not run a Health scan", async () => {
      await initComponent();

      expect(intro()).not.toBeNull();
      expect(overview()).toBeNull();
    });

    it("replaces the intro with the results once a Health scan has been run", async () => {
      await initComponent();
      expect(intro()).not.toBeNull();

      hasRunScan$.next(true);
      fixture.detectChanges();

      expect(intro()).toBeNull();
      expect(overview()).not.toBeNull();
    });
  });

  describe("scan my vault", () => {
    it("marks the Health scan as run when the User clicks the CTA", async () => {
      await initComponent();

      scanButton().click();
      await fixture.whenStable();

      expect(healthAccessService.setHasRunHealthScan).toHaveBeenCalledTimes(1);
      expect(healthAccessService.setHasRunHealthScan).toHaveBeenCalledWith(userId);
    });

    it("does not mark the Health scan as run before the User clicks the CTA", async () => {
      await initComponent();

      expect(healthAccessService.setHasRunHealthScan).not.toHaveBeenCalled();
    });

    it("does not mark the Health scan as run when there is no active account", async () => {
      activeAccount$.next(null);
      await initComponent();

      scanButton().click();
      await fixture.whenStable();

      expect(healthAccessService.setHasRunHealthScan).not.toHaveBeenCalled();
    });
  });

  describe("health tab opened state", () => {
    it("marks the Health report as opened the first time the User views it", async () => {
      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).toHaveBeenCalledWith(userId);
    });

    it("does not mark the Health report as opened when the User has already viewed it", async () => {
      hasBeenOpened$.next(true);

      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).not.toHaveBeenCalled();
    });

    it("does not mark the Health report as opened when there is no active account", async () => {
      activeAccount$.next(null);

      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).not.toHaveBeenCalled();
    });

    it("does not read User state when there is no active account", async () => {
      activeAccount$.next(null);

      await initComponent();

      expect(healthAccessService.healthHasBeenOpened$).not.toHaveBeenCalled();
      expect(healthAccessService.hasRunHealthScan$).not.toHaveBeenCalled();
    });
  });
});
