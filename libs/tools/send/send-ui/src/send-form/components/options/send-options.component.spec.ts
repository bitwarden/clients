import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { SendPolicyService } from "@bitwarden/send-ui";
import { UserId } from "@bitwarden/user-core";

import { SendFormContainer } from "../../send-form-container";

import { SendOptionsComponent } from "./send-options.component";

describe("SendOptionsComponent", () => {
  let component: SendOptionsComponent;
  let fixture: ComponentFixture<SendOptionsComponent>;
  const mockSendFormContainer = mock<SendFormContainer>();
  const mockAccountService = mock<AccountService>();
  const mockPolicyService = mock<PolicyService>();

  beforeAll(() => {
    mockAccountService.activeAccount$ = of({ id: "myTestAccount" } as Account);
  });

  beforeEach(async () => {
    mockPolicyService.policiesByType$.mockImplementation((policyType: PolicyType, userId: UserId) =>
      of([]),
    );

    await TestBed.configureTestingModule({
      imports: [SendOptionsComponent],
      declarations: [],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: SendFormContainer, useValue: mockSendFormContainer },
        { provide: PolicyService, useValue: mockPolicyService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: SendPolicyService, useValue: { disableHideEmail$: of(false) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SendOptionsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("config", {
      areSendsAllowed: true,
      mode: "add",
      sendType: SendType.Text,
    });
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("View mode", () => {
    beforeEach(async () => {
      fixture.componentRef.setInput("editing", false);
      await fixture.whenStable();
    });

    it("should not display the section at all if none of its fields are visible", () => {
      fixture.componentRef.setInput("originalSendView", {} as SendView);
      fixture.detectChanges();
      const cardEl = fixture.debugElement.query(By.css("bit-card"));
      expect(cardEl).toBeNull();
    });

    it.each([
      { maxAccessCount: 5 } as SendView,
      { hideEmail: true } as SendView,
      { notes: "My private note" } as SendView,
    ])("should display the section if any one of its subfields is visible", (originalSendView) => {
      fixture.componentRef.setInput("originalSendView", originalSendView);
      fixture.detectChanges();
      const cardEl = fixture.debugElement.query(By.css("bit-card"));
      expect(cardEl).toBeDefined();
    });

    it("should display all subfields as readonly or disabled if they are defined", () => {
      fixture.componentRef.setInput("originalSendView", {
        maxAccessCount: 5,
        hideEmail: true,
        notes: "My private note",
      } as SendView);
      fixture.detectChanges();
      const maxAccessCountEl = fixture.debugElement.query(By.css("input[type=number]"));
      expect(maxAccessCountEl).toBeDefined();
      expect(maxAccessCountEl.attributes.readonly).toEqual("");
      const hideEmailEl = fixture.debugElement.query(By.css("input[type=checkbox]"));
      expect(hideEmailEl).toBeDefined();
      expect(hideEmailEl.attributes.disabled).toEqual("");
      const privateNoteEl = fixture.debugElement.query(By.css("textarea"));
      expect(privateNoteEl).toBeDefined();
      expect(privateNoteEl.attributes.readonly).toEqual("");
    });
  });

  describe("Edit mode", () => {
    beforeEach(async () => {
      fixture.componentRef.setInput("editing", true);
      await fixture.whenStable();
    });

    it("should display all fields whether or not they are defined", () => {
      fixture.componentRef.setInput("originalSendView", {} as SendView);
      fixture.detectChanges();
      const maxAccessCountEl = fixture.debugElement.query(By.css("input[type=number]"));
      expect(maxAccessCountEl).toBeDefined();
      const hideEmailEl = fixture.debugElement.query(By.css("input[type=checkbox]"));
      expect(hideEmailEl).toBeDefined();
      const privateNoteEl = fixture.debugElement.query(By.css("textarea"));
      expect(privateNoteEl).toBeDefined();
    });
  });
});
