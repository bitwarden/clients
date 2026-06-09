import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BannerComponent } from "@bitwarden/components";

import {
  OrganizationUserNotificationBannerData,
  VaultOrganizationUserNotificationsService,
} from "../../services/vault-organization-user-notifications.service";

import { VaultOrganizationUserNotificationsComponent } from "./vault-organization-user-notifications.component";

describe("VaultOrganizationUserNotificationsComponent", () => {
  let fixture: ComponentFixture<VaultOrganizationUserNotificationsComponent>;

  const notificationData$ = new BehaviorSubject<OrganizationUserNotificationBannerData | null>(
    null,
  );
  const showNotificationBanner$ = new BehaviorSubject<boolean>(false);

  const mockService = {
    notificationData$: notificationData$.asObservable(),
    showNotificationBanner$: showNotificationBanner$.asObservable(),
    saveDismissalToState: jest.fn().mockResolvedValue(undefined),
    recordActionButtonClick: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationData: OrganizationUserNotificationBannerData = {
    organizationId: "org-id-1" as OrganizationUserNotificationBannerData["organizationId"],
    header: "Test Header",
    description: "Test description",
    buttonText: null,
    showAfterEveryLogin: false,
    revisionDate: new Date("2024-01-01"),
  };

  beforeEach(async () => {
    mockService.saveDismissalToState.mockClear();
    mockService.recordActionButtonClick.mockClear();
    notificationData$.next(null);
    showNotificationBanner$.next(false);

    await TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    })
      .overrideComponent(VaultOrganizationUserNotificationsComponent, {
        set: {
          providers: [
            { provide: VaultOrganizationUserNotificationsService, useValue: mockService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultOrganizationUserNotificationsComponent);
    fixture.detectChanges();
  });

  it("does not render a banner when showBanner is false", () => {
    const banner = fixture.debugElement.query(By.directive(BannerComponent));

    expect(banner).toBeNull();
  });

  describe("when the banner is visible", () => {
    beforeEach(() => {
      notificationData$.next(mockNotificationData);
      showNotificationBanner$.next(true);
      fixture.detectChanges();
    });

    it("renders a banner", () => {
      const banner = fixture.debugElement.query(By.directive(BannerComponent));

      expect(banner).not.toBeNull();
    });

    it("passes the header to the banner title", () => {
      const banner = fixture.debugElement.query(By.directive(BannerComponent));

      expect(banner.componentInstance.title()).toBe(mockNotificationData.header);
    });

    it("displays the description text", () => {
      const text = fixture.debugElement.nativeElement.textContent;

      expect(text).toContain(mockNotificationData.description);
    });

    describe("dismiss variant (no buttonText)", () => {
      it("does not render a button", () => {
        const button = fixture.debugElement.query(By.css("button[bitButton]"));

        expect(button).toBeNull();
      });

      it("calls saveDismissalToState when the banner is dismissed", async () => {
        const dismissButton = fixture.debugElement.query(By.css("button[bitIconButton]"));
        dismissButton.nativeElement.click();
        fixture.detectChanges();

        await fixture.whenStable();
        expect(mockService.saveDismissalToState).toHaveBeenCalledTimes(1);
      });
    });

    describe("button variant (with buttonText)", () => {
      beforeEach(() => {
        notificationData$.next({ ...mockNotificationData, buttonText: "Confirm" });
        fixture.detectChanges();
      });

      it("renders a button with the configured text", () => {
        const button = fixture.debugElement.query(By.css("button[bitButton]"));

        expect(button).not.toBeNull();
        expect(button.nativeElement.textContent.trim()).toBe("Confirm");
      });

      it("calls recordActionButtonClick with the organization id when the button is clicked", async () => {
        const button = fixture.debugElement.query(By.css("button[bitButton]"));
        button.nativeElement.click();
        fixture.detectChanges();

        await fixture.whenStable();
        expect(mockService.recordActionButtonClick).toHaveBeenCalledTimes(1);
        expect(mockService.recordActionButtonClick).toHaveBeenCalledWith(
          mockNotificationData.organizationId,
        );
        expect(mockService.saveDismissalToState).not.toHaveBeenCalled();
      });
    });
  });
});
