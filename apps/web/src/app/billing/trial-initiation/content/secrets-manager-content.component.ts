// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

@Component({
  selector: "app-secrets-manager-content",
  templateUrl: "secrets-manager-content.component.html",
})
export class SecretsManagerContentComponent implements OnInit, OnDestroy {
  header: string;
  headline =
    "A simpler, faster way to secure and automate secrets across code and infrastructure deployments";
  primaryPoints: string[];
  calloutHeadline: string;
  callouts: string[];

  private paidPrimaryPoints = [
    "Unlimited secrets, users, and projects",
    "Simple and transparent pricing",
    "Zero-knowledge, end-to-end encryption",
  ];

  private paidCalloutHeadline = "Limited time offer";

  private paidCallouts = [
    "Sign up today and receive a complimentary 12-month subscription to Bitwarden Password Manager",
    "Experience complete security across your organization",
    "Secure all your sensitive credentials, from user applications to machine secrets",
  ];

  private freePrimaryPoints = [
    "Unlimited secrets",
    "Simple and transparent pricing",
    "Zero-knowledge, end-to-end encryption",
  ];

  private freeCalloutHeadline = "Go beyond developer security!";

  private freeCallouts = [
    "Your Bitwarden account will also grant complimentary access to Bitwarden Password Manager",
    "Extend end-to-end encryption to your personal passwords, addresses, credit cards and notes",
  ];

  private destroy$ = new Subject<void>();

  constructor(private activatedRoute: ActivatedRoute) {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe((queryParameters) => {
      switch (queryParameters.org) {
        case "enterprise":
          this.header = "Secrets Manager for Enterprise";
          this.primaryPoints = this.paidPrimaryPoints;
          this.calloutHeadline = this.paidCalloutHeadline;
          this.callouts = this.paidCallouts;
          break;
        case "free":
          this.header = "Bitwarden Secrets Manager";
          this.primaryPoints = this.freePrimaryPoints;
          this.calloutHeadline = this.freeCalloutHeadline;
          this.callouts = this.freeCallouts;
          break;
        case "teams":
        case "teamsStarter":
          this.header = "Secrets Manager for Teams";
          this.primaryPoints = this.paidPrimaryPoints;
          this.calloutHeadline = this.paidCalloutHeadline;
          this.callouts = this.paidCallouts;
          break;
      }
    });
  }
}
