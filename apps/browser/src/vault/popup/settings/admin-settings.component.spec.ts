import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AutoConfirmState, AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { AdminSettingsComponent } from "./admin-settings.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() backAction: () => void;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
})
class MockPopupPageComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() loading: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-pop-out",
  template: ``,
})
class MockPopOutComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() show = true;
}

describe("AdminSettingsComponent", () => {
  let component: AdminSettingsComponent;
  let fixture: ComponentFixture<AdminSettingsComponent>;
  let autoConfirmService: MockProxy<AutomaticUserConfirmationService>;
  let nudgesService: MockProxy<NudgesService>;

  const userId = "test-user-id" as UserId;
  const mockAutoConfirmState: AutoConfirmState = {
    enabled: false,
    showSetupDialog: true,
    showBrowserNotification: false,
  };
  const mockDialogService = {
    open: jest.fn(),
  };

  beforeEach(async () => {
    autoConfirmService = mock<AutomaticUserConfirmationService>();
    nudgesService = mock<NudgesService>();

    autoConfirmService.configuration$.mockReturnValue(of(mockAutoConfirmState));
    autoConfirmService.upsert.mockResolvedValue(undefined);
    nudgesService.showNudgeSpotlight$.mockReturnValue(of(false));
    mockDialogService.open.mockClear();

    await TestBed.configureTestingModule({
      imports: [AdminSettingsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
        { provide: AutomaticUserConfirmationService, useValue: autoConfirmService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: NudgesService, useValue: nudgesService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(AdminSettingsComponent, {
        remove: {
          imports: [PopupHeaderComponent, PopupPageComponent, PopOutComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupPageComponent, MockPopOutComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AdminSettingsComponent);
    component = fixture.componentInstance;
  });

  describe("initialization", () => {
    it("should create the component", () => {
      expect(component).toBeTruthy();
    });

    it("should initialize with formLoading set to true", () => {
      expect(component["formLoading"]).toBe(true);
    });

    it("should set formLoading to false after ngOnInit", async () => {
      await component.ngOnInit();

      expect(component["formLoading"]).toBe(false);
    });

    it("should populate form with current auto-confirm state", async () => {
      const mockState: AutoConfirmState = {
        enabled: true,
        showSetupDialog: false,
        showBrowserNotification: true,
      };
      autoConfirmService.configuration$.mockReturnValue(of(mockState));

      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component["adminForm"].value).toEqual({
        autoConfirm: true,
      });
    });

    it("should populate form with disabled auto-confirm state", async () => {
      await component.ngOnInit();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component["adminForm"].value).toEqual({
        autoConfirm: false,
      });
    });
  });

  describe("auto-confirm toggle", () => {
    it("should handle dialog cancellation when enabling auto-confirm", async () => {
      const mockDialogRef = {
        closed: of(false),
      } as unknown as DialogRef<boolean>;

      mockDialogService.open.mockReturnValue(mockDialogRef);

      await component.ngOnInit();
      fixture.detectChanges();

      component["adminForm"].controls.autoConfirm.setValue(true);

      // Wait for the async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component["adminForm"].value.autoConfirm).toBe(false);
      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, {
        ...mockAutoConfirmState,
        enabled: false,
        showBrowserNotification: false,
      });
    });

    it("should disable auto-confirm without showing dialog", async () => {
      // Set up state with auto-confirm enabled
      const mockState: AutoConfirmState = {
        enabled: true,
        showSetupDialog: false,
        showBrowserNotification: false,
      };
      autoConfirmService.configuration$.mockReturnValue(of(mockState));

      // Set up dialog mock for the initial setValue during ngOnInit
      const mockDialogRef = {
        closed: of(true),
      } as unknown as DialogRef<boolean>;
      mockDialogService.open.mockReturnValue(mockDialogRef);

      await component.ngOnInit();
      fixture.detectChanges();

      // Wait for ngOnInit to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear previous calls
      autoConfirmService.upsert.mockClear();

      // Disable auto-confirm
      component["adminForm"].controls.autoConfirm.setValue(false);

      // Wait for the async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, {
        ...mockState,
        enabled: false,
        showBrowserNotification: false,
      });
    });
  });

  describe("spotlight", () => {
    beforeEach(async () => {
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it("should expose showAutoConfirmSpotlight$ observable", (done) => {
      nudgesService.showNudgeSpotlight$.mockReturnValue(of(true));

      // Create new component instance to get the updated observable
      const newFixture = TestBed.createComponent(AdminSettingsComponent);
      const newComponent = newFixture.componentInstance;

      newComponent["showAutoConfirmSpotlight$"].subscribe((show) => {
        expect(show).toBe(true);
        expect(nudgesService.showNudgeSpotlight$).toHaveBeenCalledWith(
          NudgeType.AutoConfirmNudge,
          userId,
        );
        done();
      });
    });

    it("should dismiss spotlight and update state", async () => {
      autoConfirmService.upsert.mockResolvedValue();

      await component.dismissSpotlight();

      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, {
        ...mockAutoConfirmState,
        showBrowserNotification: false,
      });
    });

    it("should use current userId when dismissing spotlight", async () => {
      autoConfirmService.upsert.mockResolvedValue();

      await component.dismissSpotlight();

      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, expect.any(Object));
    });

    it("should preserve existing state when dismissing spotlight", async () => {
      const customState: AutoConfirmState = {
        enabled: true,
        showSetupDialog: false,
        showBrowserNotification: true,
      };
      autoConfirmService.configuration$.mockReturnValue(of(customState));
      autoConfirmService.upsert.mockResolvedValue();

      await component.dismissSpotlight();

      expect(autoConfirmService.upsert).toHaveBeenCalledWith(userId, {
        ...customState,
        showBrowserNotification: false,
      });
    });
  });

  describe("form validation", () => {
    beforeEach(async () => {
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it("should have a valid form", () => {
      expect(component["adminForm"].valid).toBe(true);
    });

    it("should have autoConfirm control", () => {
      expect(component["adminForm"].controls.autoConfirm).toBeDefined();
    });
  });
});
