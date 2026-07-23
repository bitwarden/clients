import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";

import { FillAssistActiveBannerComponent } from "./fill-assist-active-banner.component";

describe("FillAssistActiveBannerComponent", () => {
  let fixture: ComponentFixture<FillAssistActiveBannerComponent>;
  let component: FillAssistActiveBannerComponent;

  const showBanner$ = new BehaviorSubject<boolean>(true);
  const mockVaultPopupAutofillService = mock<VaultPopupAutofillService>();
  const mockI18nService = mock<I18nService>();

  const bannerIsRendered = () => fixture.nativeElement.querySelector("bit-banner") != null;

  beforeEach(async () => {
    mockI18nService.t.mockImplementation((key) => key);
    (mockVaultPopupAutofillService as any).showFillAssistActiveBanner$ = showBanner$;

    await TestBed.configureTestingModule({
      imports: [FillAssistActiveBannerComponent],
      providers: [
        { provide: VaultPopupAutofillService, useValue: mockVaultPopupAutofillService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FillAssistActiveBannerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    showBanner$.next(true);
    jest.clearAllMocks();
  });

  it("renders the banner when Fill Assist is active", () => {
    fixture.detectChanges();

    expect(bannerIsRendered()).toBe(true);
  });

  it("does not render the banner when Fill Assist is not active", () => {
    showBanner$.next(false);
    fixture.detectChanges();

    expect(bannerIsRendered()).toBe(false);
  });

  it("hides the banner after dismissal even while Fill Assist is still active (session-only)", () => {
    fixture.detectChanges();
    expect(bannerIsRendered()).toBe(true);

    (component as any).onDismiss();
    fixture.detectChanges();

    expect(bannerIsRendered()).toBe(false);
    expect(showBanner$.value).toBe(true);
  });
});
