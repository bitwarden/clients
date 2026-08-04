import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, ReplaySubject } from "rxjs";

import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

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

describe("HealthComponent", () => {
  const userId = Utils.newGuid() as UserId;

  let fixture: ComponentFixture<HealthComponent>;
  let activeAccount$: ReplaySubject<Account | null>;
  let hasBeenOpened$: BehaviorSubject<boolean>;
  let healthAccessService: MockProxy<HealthAccessService>;

  /** Creates the component and flushes the microtask that writes the state. */
  async function initComponent() {
    fixture = TestBed.createComponent(HealthComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    activeAccount$ = new ReplaySubject<Account | null>(1);
    activeAccount$.next({ id: userId } as Account);

    hasBeenOpened$ = new BehaviorSubject<boolean>(false);

    healthAccessService = mock<HealthAccessService>();
    healthAccessService.healthHasBeenOpened$.mockReturnValue(hasBeenOpened$);

    await TestBed.configureTestingModule({
      imports: [HealthComponent],
      providers: [
        { provide: AccountService, useValue: { activeAccount$ } },
        { provide: HealthAccessService, useValue: healthAccessService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(HealthComponent, {
        remove: {
          imports: [
            PopupPageComponent,
            PopupHeaderComponent,
            PopOutComponent,
            CurrentAccountComponent,
          ],
        },
        add: {
          imports: [
            MockPopupPageComponent,
            MockPopupHeaderComponent,
            MockPopOutComponent,
            MockCurrentAccountComponent,
          ],
        },
      })
      .compileComponents();
  });

  describe("ngOnInit", () => {
    it("marks the Health report as opened the first time the User views it", async () => {
      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).toHaveBeenCalledWith(userId);
    });

    it("does not mark the Health report as opened when the User has already viewed it", async () => {
      hasBeenOpened$.next(true);

      await initComponent();

      expect(healthAccessService.setHealthHasBeenOpened).not.toHaveBeenCalled();
    });
  });
});
