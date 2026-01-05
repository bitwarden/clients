import { CommonModule } from "@angular/common";
import { ComponentRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/sdk-internal";

import { FakeAccountService, mockAccountServiceWith } from "../../../../../common/spec";

import { NewItemNudgeComponent } from "./new-item-nudge.component";

describe("NewItemNudgeComponent", () => {
  let component: NewItemNudgeComponent;
  let componentRef: ComponentRef<NewItemNudgeComponent>;
  let fixture: ComponentFixture<NewItemNudgeComponent>;

  let i18nService: MockProxy<I18nService>;
  let nudgesService: MockProxy<NudgesService>;
  const accountService: FakeAccountService = mockAccountServiceWith("test-user-id" as UserId);

  beforeEach(async () => {
    i18nService = mock<I18nService>({ t: (key: string) => key });
    nudgesService = mock<NudgesService>();

    await TestBed.configureTestingModule({
      imports: [NewItemNudgeComponent, CommonModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: accountService },
        { provide: NudgesService, useValue: nudgesService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewItemNudgeComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput("configType", null); // Set a default type for testing
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should set nudge title and body for CipherType.Login type", async () => {
    componentRef.setInput("configType", CipherType.Login);
    fixture.detectChanges();
    component.showNewItemSpotlight$.subscribe((value) => {
      expect(value).toEqual(true);
    });
    expect(component.nudgeTitle).toBe("newLoginNudgeTitle");
    expect(component.nudgeBody).toBe(
      "newLoginNudgeBodyOne <strong>newLoginNudgeBodyBold</strong> newLoginNudgeBodyTwo",
    );
    expect(component.dismissalNudgeType).toBe(NudgeType.NewLoginItemStatus);
  });

  it("should set nudge title and body for CipherType.Card type", async () => {
    componentRef.setInput("configType", CipherType.Card);
    fixture.detectChanges();
    component.showNewItemSpotlight$.subscribe((value) => {
      expect(value).toEqual(true);
    });
    expect(component.nudgeTitle).toBe("newCardNudgeTitle");
    expect(component.nudgeBody).toBe("newCardNudgeBody");
    expect(component.dismissalNudgeType).toBe(NudgeType.NewCardItemStatus);
  });

  it("should not show anything if spotlight has been dismissed", async () => {
    componentRef.setInput("configType", CipherType.Identity);
    fixture.detectChanges();
    component.showNewItemSpotlight$.subscribe((value) => {
      expect(value).toEqual(false);
    });
    expect(component.dismissalNudgeType).toBe(NudgeType.NewIdentityItemStatus);
  });

  it("should set showNewItemSpotlight to false when user dismisses spotlight", async () => {
    component.showNewItemSpotlight$ = of(true);
    component.dismissalNudgeType = NudgeType.NewLoginItemStatus;
    const activeUserId = "test-user-id" as UserId;
    component.activeUserId$ = of(activeUserId);

    const dismissSpy = jest.spyOn(nudgesService, "dismissNudge").mockResolvedValue();

    await component.dismissNewItemSpotlight();

    component.showNewItemSpotlight$.subscribe((value) => {
      expect(value).toEqual(false);
    });
    expect(dismissSpy).toHaveBeenCalledWith(NudgeType.NewLoginItemStatus, activeUserId);
  });
});
