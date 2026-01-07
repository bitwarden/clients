import { ChangeDetectionStrategy, Component, input } from "@angular/core";
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
import { DialogService } from "@bitwarden/components";

import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

import { AdminSettingsComponent } from "./admin-settings.component";

@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupHeaderComponent {
  readonly pageTitle = input<string>();
  readonly backAction = input<() => void>();
}

@Component({
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopupPageComponent {
  readonly loading = input<boolean>();
}

@Component({
  selector: "app-pop-out",
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockPopOutComponent {
  readonly show = input<boolean>(true);
}

describe("AdminSettingsComponent", () => {
  let component: AdminSettingsComponent;
  let fixture: ComponentFixture<AdminSettingsComponent>;
  let autoConfirmService: MockProxy<AutomaticUserConfirmationService>;
  let nudgesService: MockProxy<NudgesService>;
  let mockDialogService: MockProxy<DialogService>;

  const userId = "test-user-id" as UserId;
  const mockAutoConfirmState: AutoConfirmState = {
    enabled: false,
    showSetupDialog: true,
    showBrowserNotification: false,
  };

  beforeEach(async () => {
    autoConfirmService = mock<AutomaticUserConfirmationService>();
    nudgesService = mock<NudgesService>();
    mockDialogService = mock<DialogService>();

    autoConfirmService.configuration$.mockReturnValue(of(mockAutoConfirmState));
    autoConfirmService.upsert.mockResolvedValue(undefined);
    nudgesService.showNudgeSpotlight$.mockReturnValue(of(false));

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

  describe("spotlight", () => {
    beforeEach(async () => {
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it("should expose showAutoConfirmSpotlight$ observable", (done) => {
      nudgesService.showNudgeSpotlight$.mockReturnValue(of(true));

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
