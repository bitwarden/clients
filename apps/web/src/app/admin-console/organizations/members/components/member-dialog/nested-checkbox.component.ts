import { AsyncPipe } from "@angular/common";
import { Component, ChangeDetectionStrategy, computed, input } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { map, startWith, switchMap } from "rxjs";

import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-nested-checkbox",
  templateUrl: "nested-checkbox.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, CheckboxModule, FormFieldModule, I18nPipe],
})
export class NestedCheckboxComponent {
  readonly parentId = input.required<string>();
  readonly checkboxes = input.required<FormGroup<Record<string, FormControl<boolean>>>>();

  protected readonly children = computed(() =>
    Object.entries(this.checkboxes().controls).filter(([key]) => key !== this.parentId()),
  );

  protected readonly parentIndeterminate$ = toObservable(this.checkboxes).pipe(
    switchMap((checkboxes) =>
      checkboxes.valueChanges.pipe(
        startWith(checkboxes.value),
        map((values) => {
          const childValues = Object.entries(values)
            .filter(([key]) => key !== this.parentId())
            .map(([, v]) => v as boolean);
          return childValues.some(Boolean) && !childValues.every(Boolean);
        }),
      ),
    ),
  );

  constructor() {
    toObservable(this.checkboxes)
      .pipe(
        switchMap((checkboxes) => checkboxes.controls[this.parentId()].valueChanges),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        Object.values(this.checkboxes().controls).forEach((control) =>
          control.setValue(value, { emitEvent: false }),
        );
      });
  }

  protected onChildCheck() {
    const parentChecked = this.children().every(([, value]) => value.value === true);
    this.checkboxes().controls[this.parentId()].setValue(parentChecked, { emitEvent: false });
  }
}
