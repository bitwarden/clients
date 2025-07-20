// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KeyValue } from "@angular/common";
import { Component, Input, OnInit, OnDestroy } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";

@Component({
  selector: "app-nested-checkbox",
  templateUrl: "nested-checkbox.component.html",
  standalone: false,
})
export class NestedCheckboxComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() parentId: string;
  @Input() checkboxes: FormGroup<Record<string, FormControl<boolean>>>;

  get parentIndeterminate() {
    return (
      this.children.some(([key, control]) => control.value == true) &&
      !this.children.every(([key, control]) => control.value == true)
    );
  }

  ngOnInit(): void {
    this.checkboxes.controls[this.parentId].valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        Object.values(this.checkboxes.controls).forEach((control) =>
          control.setValue(value, { emitEvent: false }),
        );
      });
  }

  private get parentCheckbox() {
    return this.checkboxes.controls[this.parentId];
  }

  get children() {
    return Object.entries(this.checkboxes.controls).filter(([key, value]) => key != this.parentId);
  }

  protected onChildCheck() {
    const parentChecked = this.children.every(([key, value]) => value.value == true);
    this.parentCheckbox.setValue(parentChecked, { emitEvent: false });
  }

  protected key(index: number, item: KeyValue<string, FormControl<boolean>>) {
    return item.key;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  pascalize(s: string) {
    return Utils.camelToPascalCase(s);
  }
}
