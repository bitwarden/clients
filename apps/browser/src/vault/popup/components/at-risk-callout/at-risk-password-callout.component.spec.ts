import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { AtRiskPasswordCalloutService } from "@bitwarden/vault";

import { AtRiskPasswordCalloutComponent } from "./at-risk-password-callout.component";

describe("AtRiskPasswordCalloutComponent", () => {
  let component: AtRiskPasswordCalloutComponent;
  let fixture: ComponentFixture<AtRiskPasswordCalloutComponent>;

  const userId = "user-A" as UserId;

  const activeAccount$ = new BehaviorSubject<{ id: UserId } | null>({ id: userId });
  const mockAccountService = {
    activeAccount$: activeAccount$,
  };
  const mockAtRiskPasswordCalloutService = {
    showCompletedTasksBanner$: jest.fn(() => of(false)),
    pendingTasks$: jest.fn(() => of([] as SecurityTask[])),
    updateAtRiskPasswordState: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtRiskPasswordCalloutComponent, RouterModule.forRoot([])],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: I18nService, useValue: mock<I18nService>() },
      ],
    })
      .overrideComponent(AtRiskPasswordCalloutComponent, {
        remove: {
          providers: [AtRiskPasswordCalloutService],
        },
        add: {
          providers: [
            { provide: AtRiskPasswordCalloutService, useValue: mockAtRiskPasswordCalloutService },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AtRiskPasswordCalloutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("currentPendingTasks$", () => {
    it("should not display warning banner when no pending tasks", () => {
      const banner = fixture.debugElement.query(By.css("bit-banner[bannerType='warning']"));
      expect(banner).toBeNull();
    });

    it("should display warning banner when pending tasks exist", () => {
      const tasks: SecurityTask[] = [
        {
          id: "first-task",
          organizationId: "org-1",
          cipherId: "cipher-1",
          type: SecurityTaskType.UpdateAtRiskCredential,
        } as SecurityTask,
      ];
      mockAtRiskPasswordCalloutService.pendingTasks$.mockReturnValue(of(tasks));

      fixture = TestBed.createComponent(AtRiskPasswordCalloutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const banner = fixture.debugElement.query(By.css("bit-banner[bannerType='warning']"));
      expect(banner).toBeTruthy();
    });
  });

  describe("showCompletedTasksBanner$", () => {
    it("should not display info banner when showCompletedTasksBanner is false", () => {
      const banner = fixture.debugElement.query(By.css("bit-banner[bannerType='info']"));
      expect(banner).toBeNull();
    });

    it("should display info banner when showCompletedTasksBanner is true", () => {
      mockAtRiskPasswordCalloutService.showCompletedTasksBanner$.mockReturnValue(of(true));

      fixture = TestBed.createComponent(AtRiskPasswordCalloutComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const banner = fixture.debugElement.query(By.css("bit-banner[bannerType='info']"));
      expect(banner).toBeTruthy();
    });
  });

  describe("successBannerDismissed", () => {
    it("should call updateAtRiskPasswordState with correct parameters", async () => {
      await component.successBannerDismissed();

      expect(mockAtRiskPasswordCalloutService.updateAtRiskPasswordState).toHaveBeenCalledWith(
        userId,
        {
          hasInteractedWithTasks: true,
          tasksBannerDismissed: true,
        },
      );
    });
  });
});
