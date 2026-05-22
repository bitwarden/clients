// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  Output,
  QueryList,
} from "@angular/core";

import { BitwardenIcon } from "@bitwarden/components";

import { OnboardingTaskComponent } from "./onboarding-task.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-onboarding",
  templateUrl: "./onboarding.component.html",
  standalone: false,
})
export class OnboardingComponent implements AfterContentInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ContentChildren(OnboardingTaskComponent) tasks: QueryList<OnboardingTaskComponent>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() title: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() subtitle?: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() startIcon?: BitwardenIcon;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() dismiss = new EventEmitter<void>();

  protected open = true;

  protected get amountCompleted(): number {
    return this.tasks.filter((task) => task.completed).length;
  }

  ngAfterContentInit(): void {
    this.open = this.amountCompleted <= 1;
  }
}
