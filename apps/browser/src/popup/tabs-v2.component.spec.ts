import { Component } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from "@angular/core/testing";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { HasNudgeService } from "@bitwarden/vault";

import { PopupTabNavigationComponent } from "../platform/popup/layout/popup-tab-navigation.component";

import { TabsV2Component } from "./tabs-v2.component";

@Component({
  selector: "app-vault-berry",
  template: `<div data-testid="vault-berry">Vault Berry</div>`,
})
class DummyVaultBerryComponent {}

describe("TabsV2Component", () => {
  let fixture: ComponentFixture<TabsV2Component>;

  let accountSubject: BehaviorSubject<any>;
  let hasNudgeSubject: BehaviorSubject<boolean>;
  const configServiceMock = mock<ConfigService>();

  const accountServiceStub = {
    activeAccount$: undefined as any,
  };

  const hasNudgeServiceStub = {
    shouldShowNudge$: () => hasNudgeSubject.asObservable(),
  };

  beforeEach(async () => {
    jest.spyOn(configServiceMock, "getFeatureFlag$").mockReturnValue(of(true));
    await TestBed.configureTestingModule({
      imports: [RouterModule, PopupTabNavigationComponent],
      declarations: [TabsV2Component, DummyVaultBerryComponent],
      providers: [
        { provide: AccountService, useValue: accountServiceStub },
        { provide: HasNudgeService, useValue: hasNudgeServiceStub },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(TabsV2Component, {
        set: {
          providers: [{ provide: HasNudgeService, useValue: hasNudgeServiceStub }],
        },
      })
      .compileComponents();

    accountSubject = new BehaviorSubject({
      id: "user123" as UserId,
      email: "test@example.com",
      emailVerified: true,
      name: "Test User",
    });
    hasNudgeSubject = new BehaviorSubject<boolean>(false);

    accountServiceStub.activeAccount$ = accountSubject.asObservable();

    fixture = TestBed.createComponent(TabsV2Component);
    fixture.detectChanges();
  });

  it("should display vault berry when active account exists and the nudge is true", fakeAsync(() => {
    hasNudgeSubject.next(true);
    tick();
    fixture.detectChanges();
    flush();
    const compiled = fixture.nativeElement as HTMLElement;
    const berryElement = compiled.querySelector('[data-testid="vault-berry"]');
    expect(berryElement).toBeTruthy();
  }));

  it("should not display vault berry when active account exists and the nudge is false", fakeAsync(() => {
    hasNudgeSubject.next(false);
    tick();
    fixture.detectChanges();
    flush();
    const compiled = fixture.nativeElement as HTMLElement;
    const berryElement = compiled.querySelector('[data-testid="vault-berry"]');
    expect(berryElement).toBeFalsy();
  }));
});
