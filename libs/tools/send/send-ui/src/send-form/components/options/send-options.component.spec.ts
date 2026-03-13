import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";

import { SendFormService } from "../../abstractions/send-form.service";
import { SendFormContainer } from "../../send-form-container";

import { SendOptionsComponent } from "./send-options.component";

describe("SendOptionsComponent", () => {
  let component: SendOptionsComponent;
  let fixture: ComponentFixture<SendOptionsComponent>;
  const mockSendFormContainer = mock<SendFormContainer>();
  const mockAccountService = mock<AccountService>();
  const mockSendFormService = mock<SendFormService>();

  beforeAll(() => {
    mockAccountService.activeAccount$ = of({ id: "myTestAccount" } as Account);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendOptionsComponent],
      declarations: [],
      providers: [
        { provide: SendFormContainer, useValue: mockSendFormContainer },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: AccountService, useValue: mockAccountService },
        { provide: SendFormService, useValue: mockSendFormService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SendOptionsComponent);
    component = fixture.componentInstance;
    mockSendFormService.sendFormConfig = {
      areSendsAllowed: true,
      mode: "add",
      sendType: SendType.Text,
    };
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
