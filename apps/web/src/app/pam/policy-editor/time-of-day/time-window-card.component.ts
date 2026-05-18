import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, FormFieldModule, IconButtonModule } from "@bitwarden/components";
import { DayOfWeek, TimeWindow } from "@bitwarden/pam";

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

@Component({
  selector: "pam-time-window-card",
  templateUrl: "./time-window-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, JslibModule, ButtonModule, FormFieldModule, IconButtonModule],
})
export class TimeWindowCardComponent {
  readonly window = input.required<TimeWindow>();
  readonly index = input.required<number>();
  readonly canRemove = input<boolean>(true);
  readonly disabled = input<boolean>(false);

  readonly windowChange = output<TimeWindow>();
  readonly remove = output<void>();

  protected readonly allDays = ALL_DAYS;
  protected readonly dayLabels = DAY_LABELS;

  protected readonly fromError = signal<string | null>(null);
  protected readonly toError = signal<string | null>(null);

  protected readonly hasTimeError = computed(
    () => this.fromError() !== null || this.toError() !== null,
  );

  protected isDaySelected(day: DayOfWeek): boolean {
    return this.window().daysOfWeek.includes(day);
  }

  protected toggleDay(day: DayOfWeek): void {
    if (this.disabled()) {
      return;
    }
    const current = this.window().daysOfWeek;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    this.windowChange.emit({ ...this.window(), daysOfWeek: next });
  }

  protected onFromChange(value: string): void {
    this.fromError.set(null);
    this.toError.set(null);
    const updated: TimeWindow = { ...this.window(), from: value };
    this.validateTimes(value, this.window().to);
    this.windowChange.emit(updated);
  }

  protected onToChange(value: string): void {
    this.fromError.set(null);
    this.toError.set(null);
    const updated: TimeWindow = { ...this.window(), to: value };
    this.validateTimes(this.window().from, value);
    this.windowChange.emit(updated);
  }

  private validateTimes(from: string, to: string): void {
    if (from && to && from >= to) {
      this.toError.set("policyTimeOfDayFromBeforeTo");
    }
  }

  protected onRemove(): void {
    this.remove.emit();
  }
}
