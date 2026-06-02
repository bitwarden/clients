import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { OnboardingTaskComponent } from "./onboarding-task.component";
import { OnboardingComponent } from "./onboarding.component";

@Component({
  template: `
    <app-onboarding title="Get started">
      <app-onboarding-task title="Task 1" [completed]="task1"></app-onboarding-task>
      <app-onboarding-task title="Task 2" [completed]="task2"></app-onboarding-task>
      <app-onboarding-task title="Task 3" [completed]="task3"></app-onboarding-task>
    </app-onboarding>
  `,
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  task1 = false;
  task2 = false;
  task3 = false;
}

describe("OnboardingComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let onboarding: OnboardingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingComponent, OnboardingTaskComponent],
      declarations: [TestHostComponent],
      providers: [
        provideRouter([]),
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              onboardingTasksComplete: "__$1__ of __$2__ complete",
              completed: "Completed",
              dismissThisChecklist: "Dismiss this checklist",
            }),
        },
      ],
    }).compileComponents();
  });

  function setupWithCompletion(task1: boolean, task2: boolean, task3: boolean) {
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    host.task1 = task1;
    host.task2 = task2;
    host.task3 = task3;
    fixture.detectChanges();
    onboarding = fixture.debugElement.children[0].componentInstance;
  }

  describe("ngAfterContentInit default open state", () => {
    it("opens when zero tasks are complete", () => {
      setupWithCompletion(false, false, false);
      expect((onboarding as any).open()).toBe(true);
    });

    it("opens when exactly one task is complete", () => {
      setupWithCompletion(true, false, false);
      expect((onboarding as any).open()).toBe(true);
    });

    it("collapses when two tasks are complete", () => {
      setupWithCompletion(true, true, false);
      expect((onboarding as any).open()).toBe(false);
    });

    it("collapses when all tasks are complete", () => {
      setupWithCompletion(true, true, true);
      expect((onboarding as any).open()).toBe(false);
    });
  });
});
