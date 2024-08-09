import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subject, combineLatest, filter, startWith, switchMap, takeUntil } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { ServiceAccountCounts } from "../models/view/counts.view";
import { ServiceAccountView } from "../models/view/service-account.view";
import { AccessPolicyService } from "../shared/access-policies/access-policy.service";
import { CountService } from "../shared/counts/count.service";

import { AccessService } from "./access/access.service";
import { AccessTokenCreateDialogComponent } from "./access/dialogs/access-token-create-dialog.component";
import { ServiceAccountService } from "./service-account.service";

@Component({
  selector: "sm-service-account",
  templateUrl: "./service-account.component.html",
})
export class ServiceAccountComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private serviceAccountId: string;

  private onChange$ = this.serviceAccountService.serviceAccount$.pipe(
    filter((sa) => sa?.id === this.serviceAccountId),
    startWith(null),
  );

  private serviceAccountView: ServiceAccountView;
  protected serviceAccount$ = combineLatest([this.route.params, this.onChange$]).pipe(
    switchMap(([params, _]) =>
      this.serviceAccountService.getByServiceAccountId(
        params.serviceAccountId,
        params.organizationId,
      ),
    ),
  );
  protected serviceAccountCounts: ServiceAccountCounts;

  constructor(
    private route: ActivatedRoute,
    private serviceAccountService: ServiceAccountService,
    private accessPolicyService: AccessPolicyService,
    private accessService: AccessService,
    private dialogService: DialogService,
    private countService: CountService,
  ) {}

  ngOnInit(): void {
    const serviceAccountCounts$ = combineLatest([
      this.route.params,
      this.accessPolicyService.accessPolicy$.pipe(startWith(null)),
      this.accessService.accessToken$.pipe(startWith(null)),
      this.onChange$,
    ]).pipe(
      switchMap(([params, _]) =>
        this.countService.getServiceAccountCounts(params.serviceAccountId),
      ),
    );

    combineLatest([this.serviceAccount$, serviceAccountCounts$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([serviceAccountView, serviceAccountCounts]) => {
        this.serviceAccountView = serviceAccountView;
        this.serviceAccountCounts = {
          projects: serviceAccountCounts.projects,
          people: serviceAccountCounts.people,
          accessTokens: serviceAccountCounts.accessTokens,
        };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected openNewAccessTokenDialog() {
    AccessTokenCreateDialogComponent.openNewAccessTokenDialog(
      this.dialogService,
      this.serviceAccountView,
    );
  }
}
