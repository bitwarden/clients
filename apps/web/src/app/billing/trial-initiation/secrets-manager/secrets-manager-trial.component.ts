// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

@Component({
  selector: "app-secrets-manager-trial",
  templateUrl: "secrets-manager-trial.component.html",
})
export class SecretsManagerTrialComponent implements OnInit, OnDestroy {
  organizationTypeQueryParameter: string;

  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((queryParameters) => {
      this.organizationTypeQueryParameter = queryParameters.org;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get freeOrganization() {
    return this.organizationTypeQueryParameter === "free";
  }
}
