// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { SharedModule } from "../../../shared";

@Component({
  selector: "app-send-access-password",
  templateUrl: "send-access-password.component.html",
  imports: [SharedModule],
})
export class SendAccessPasswordComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  protected formGroup = this.formBuilder.group({
    password: ["", [Validators.required]],
  });

  @Input() loading: boolean;
  @Output() setPasswordEvent = new EventEmitter<string>();

  constructor(private formBuilder: FormBuilder) {}

  async ngOnInit() {
    this.formGroup.controls.password.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val) => {
        this.setPasswordEvent.emit(val);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
