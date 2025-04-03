import { Component } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { VaultNudgeType, VaultNudgesService } from "@bitwarden/vault";

import { TabsV2Component } from "./tabs-v2.component";

// Dummy vault berry component with a test id.
@Component({
  selector: "app-vault-berry",
  template: `<div data-testid="vault-berry">Vault Berry</div>`,
})
class DummyVaultBerryComponent {}

// Dummy popup tab navigation component.
@Component({
  selector: "popup-tab-navigation",
  template: `<ng-content></ng-content>`,
})
class DummyPopupTabNavigationComponent {}

describe("TabsV2Component", () => {
  let component: TabsV2Component;
  let fixture: ComponentFixture<TabsV2Component>;

  // Use a BehaviorSubject so the active account remains available.
  const accountSubject = new BehaviorSubject({
    id: "user123" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
  });
  const accountServiceStub = {
    activeAccount$: accountSubject.asObservable(),
  };

  // Stub VaultNudgesService: return true for HasVaultItems.
  const vaultNudgesServiceStub = {
    showNudge$: jest.fn((nudgeType: VaultNudgeType, userId: UserId) => {
      return nudgeType === VaultNudgeType.HasVaultItems ? of(true) : of(false);
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule],
      declarations: [TabsV2Component, DummyVaultBerryComponent, DummyPopupTabNavigationComponent],
      providers: [
        { provide: AccountService, useValue: accountServiceStub },
        { provide: StateProvider, useValue: {} },
      ],
    })
      // IMPORTANT: Override the component BEFORE compiling components.
      .overrideComponent(TabsV2Component, {
        set: {
          providers: [{ provide: VaultNudgesService, useValue: vaultNudgesServiceStub }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TabsV2Component);
    component = fixture.componentInstance;
    // Explicitly set the initial list of nudge types.
    component.nudgeTypes = [VaultNudgeType.HasVaultItems, VaultNudgeType.IntroCarouselDismissal];
  });

  test("should display vault berry when active account exists and the nudge is true", fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const berryElement = compiled.querySelector('[data-testid="vault-berry"]');
    expect(berryElement).toBeTruthy();
  }));
});
