import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
  output,
  signal,
} from "@angular/core";

import {
  AccordionComponent,
  BadgeComponent,
  BitwardenIcon,
  ButtonComponent,
  IconComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OnboardingTaskComponent } from "./onboarding-task.component";

@Component({
  selector: "app-onboarding",
  templateUrl: "./onboarding.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccordionComponent, BadgeComponent, ButtonComponent, IconComponent, I18nPipe],
})
export class OnboardingComponent implements AfterContentInit {
  readonly tasks = contentChildren(OnboardingTaskComponent);
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly startIcon = input<BitwardenIcon>();

  readonly dismiss = output<void>();

  protected readonly open = signal(true);

  protected readonly amountCompleted = computed(
    () => this.tasks().filter((task) => task.completed()).length,
  );

  ngAfterContentInit(): void {
    this.open.set(this.amountCompleted() <= 1);
  }
}
