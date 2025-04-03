import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Component } from "@angular/core";
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  flushMicrotasks,
  tick,
} from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { VaultNudgeType, VaultNudgesService } from "@bitwarden/vault";

import { TabsV2Component } from "./tabs-v2.component";

class DummyStateProvider {}

@Component({
  selector: "app-vault-berry",
  template: `<div data-testid="vault-berry">Vault Berry</div>`,
})
class DummyVaultBerryComponent {}

@Component({
  selector: "popup-tab-navigation",
  template: `<ng-content></ng-content>`,
})
class DummyPopupTabNavigationComponent {}

class FakeAriaLive {
  announce(message: string): Promise<void> {
    return Promise.resolve();
  }
}

describe("TabsV2Component", () => {
  let component: TabsV2Component;
  let fixture: ComponentFixture<TabsV2Component>;

  let accountSubject: BehaviorSubject<any>;
  let hasVaultItemsSubject: BehaviorSubject<boolean>;
  let introCarouselSubject: BehaviorSubject<boolean>;

  const accountServiceStub = {
    activeAccount$: undefined as any,
  };

  const vaultNudgesServiceStubSubjects = {
    showNudge$: jest.fn((nudgeType: VaultNudgeType, userId: string) => {
      if (nudgeType === VaultNudgeType.HasVaultItems) {
        return hasVaultItemsSubject.asObservable();
      } else if (nudgeType === VaultNudgeType.IntroCarouselDismissal) {
        return introCarouselSubject.asObservable();
      }
      return of(false);
    }),
  };

  const ariaLive = new FakeAriaLive();
  const ariaLiveSpy = jest.spyOn(ariaLive, "announce").mockResolvedValue();

  const i18nServiceStub = {
    t: (key: string) => "New notification available!",
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule],
      declarations: [TabsV2Component, DummyVaultBerryComponent, DummyPopupTabNavigationComponent],
      providers: [
        { provide: AccountService, useValue: accountServiceStub },
        { provide: StateProvider, useClass: DummyStateProvider },
        { provide: I18nService, useValue: i18nServiceStub },
        { provide: LiveAnnouncer, useValue: ariaLive },
      ],
    })
      .overrideComponent(TabsV2Component, {
        set: {
          providers: [{ provide: VaultNudgesService, useValue: vaultNudgesServiceStubSubjects }],
        },
      })
      .compileComponents();

    accountSubject = new BehaviorSubject({
      id: "user123" as UserId,
      email: "test@example.com",
      emailVerified: true,
      name: "Test User",
    });
    hasVaultItemsSubject = new BehaviorSubject<boolean>(false);
    introCarouselSubject = new BehaviorSubject<boolean>(false);

    accountServiceStub.activeAccount$ = accountSubject.asObservable();

    fixture = TestBed.createComponent(TabsV2Component);
    component = fixture.componentInstance;
    component.nudgeTypes = [VaultNudgeType.HasVaultItems, VaultNudgeType.IntroCarouselDismissal];
    fixture.detectChanges();
  });

  it("should display vault berry when active account exists and the nudge is true", fakeAsync(() => {
    hasVaultItemsSubject.next(true);
    tick();
    fixture.detectChanges();
    flush();
    const compiled = fixture.nativeElement as HTMLElement;
    const berryElement = compiled.querySelector('[data-testid="vault-berry"]');
    expect(berryElement).toBeTruthy();
  }));

  it("should not display vault berry when active account exists and the nudge is false", fakeAsync(() => {
    hasVaultItemsSubject.next(false);
    tick();
    fixture.detectChanges();
    flush();
    const compiled = fixture.nativeElement as HTMLElement;
    const berryElement = compiled.querySelector('[data-testid="vault-berry"]');
    expect(berryElement).toBeFalsy();
  }));

  it("should announce when showBerry transitions from false to true", fakeAsync(() => {
    fixture = TestBed.createComponent(TabsV2Component);
    component = fixture.componentInstance;
    component.nudgeTypes = [VaultNudgeType.HasVaultItems, VaultNudgeType.IntroCarouselDismissal];
    component.ngOnInit?.();
    fixture.detectChanges();

    hasVaultItemsSubject.next(true);
    tick(100);
    flushMicrotasks();
    fixture.detectChanges();

    expect(ariaLiveSpy).toHaveBeenCalled();
    expect(ariaLiveSpy).toHaveBeenCalledWith("New notification available!");
  }));
});
