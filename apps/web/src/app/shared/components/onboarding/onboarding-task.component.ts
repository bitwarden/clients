// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

@Component({
  selector: "app-onboarding-task",
  templateUrl: "./onboarding-task.component.html",
  host: {
    class: "tw-max-w-max",
  },
  standalone: false,
})
export class OnboardingTaskComponent {
  @Input()
  completed = false;

  @Input()
  icon = "bwi-info-circle";

  @Input()
  title: string;

  @Input()
  route: string | any[];

  @Input()
  isDisabled: boolean = false;

  handleClick(ev: MouseEvent) {
    /**
     * If the main `ng-content` is clicked, we don't want to trigger the task's click handler.
     */
    ev.stopPropagation();
  }
}
