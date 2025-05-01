import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconModule,
  LinkModule,
} from "@bitwarden/components";

@Component({
  standalone: true,
  templateUrl: "phishing-warning.html",
  imports: [
    CommonModule,
    IconModule,
    JslibModule,
    LinkModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    CheckboxModule,
    ButtonModule,
    RouterModule,
  ],
})
export class PhishingWarning implements OnInit, OnDestroy {
  formGroup = this.formBuilder.group({
    phishingHost: [""],
  });

  private destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private formBuilder: FormBuilder,
  ) {}

  async ngOnInit(): Promise<void> {
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.formGroup.patchValue({ phishingHost: params.get("phishingHost") });
      this.formGroup.get("phishingHost")?.disable();
    });
  }
  closeTab(): void {
    globalThis.close();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
