import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { CipherAccessState, PamApiService } from "../../abstractions/pam-api.service";
import { AccessPreCheckResponse } from "../../abstractions/responses/access-pre-check.response";
import { AccessRequestDetailsResponse } from "../../abstractions/responses/access-request-details.response";

import { CipherLeaseBannerComponent } from "./cipher-lease-banner.component";

const i18nFake: Pick<I18nService, "t" | "translate"> = {
  t: (id: string) => id,
  translate: (id: string) => id,
};

describe("CipherLeaseBannerComponent fold-out", () => {
  let fixture: ComponentFixture<CipherLeaseBannerComponent>;
  let component: CipherLeaseBannerComponent;

  const setup = (state: CipherAccessState = {}, flagOn = true) => {
    const pamApi: Partial<PamApiService> = {
      getCipherAccessState$: jest.fn().mockReturnValue(of(state)),
      getAccessPreCheck: jest.fn().mockResolvedValue(
        new AccessPreCheckResponse({
          CipherId: "cipher-1",
          ApprovalMode: "automatic",
          HasActiveLease: false,
        }),
      ),
      submitAccessRequest: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [CipherLeaseBannerComponent],
      providers: [
        { provide: PamApiService, useValue: pamApi },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: DialogService, useValue: { openSimpleDialog: jest.fn() } },
        { provide: I18nService, useValue: i18nFake },
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" } as Account) } },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: jest.fn().mockReturnValue(of(flagOn)) },
        },
      ],
    });

    fixture = TestBed.createComponent(CipherLeaseBannerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("cipherId", "cipher-1");
    fixture.componentRef.setInput("partialData", '{"Name":"n"}');
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  it("shows the 'Request access' entry point for a gated cipher with no lease/request, form collapsed", () => {
    setup();

    expect(component["canRequestAccess"]()).toBe(true);
    const toggle = fixture.debugElement.query(
      By.css("#cipher-lease-banner_button_request-access-toggle"),
    );
    expect(toggle.nativeElement.textContent).toContain("pamRequestAccessButton");
    expect(fixture.debugElement.query(By.css("app-request-access-form"))).toBeNull();
  });

  it("folds out the inline form on toggle and collapses again", () => {
    setup();

    component["toggleRequestForm"]();
    fixture.detectChanges();
    expect(component["requestFormExpanded"]()).toBe(true);
    expect(fixture.debugElement.query(By.css("app-request-access-form"))).toBeTruthy();

    component["toggleRequestForm"]();
    fixture.detectChanges();
    expect(component["requestFormExpanded"]()).toBe(false);
    expect(fixture.debugElement.query(By.css("app-request-access-form"))).toBeNull();
  });

  it("collapses the fold-out when the inline form reports a submission", () => {
    setup();
    component["toggleRequestForm"]();
    fixture.detectChanges();
    expect(component["requestFormExpanded"]()).toBe(true);

    component["onRequestSubmitted"]();
    fixture.detectChanges();
    expect(component["requestFormExpanded"]()).toBe(false);
  });

  it("hides the entry point once a pending request exists", () => {
    setup({ pendingRequest: { id: "req-1" } as AccessRequestDetailsResponse });

    expect(component["canRequestAccess"]()).toBe(false);
  });
});
