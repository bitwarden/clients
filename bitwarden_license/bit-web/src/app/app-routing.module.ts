import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard, unauthGuardFn } from "@bitwarden/angular/auth/guards";
import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AnonLayoutWrapperComponent } from "@bitwarden/components";
import { deepLinkGuard } from "@bitwarden/web-vault/app/auth/guards/deep-link/deep-link.guard";
import { RouteDataProperties } from "@bitwarden/web-vault/app/core";
import { UserLayoutComponent } from "@bitwarden/web-vault/app/layouts/user-layout.component";

import { ProvidersModule } from "./admin-console/providers/providers.module";
import { VerifyRecoverDeleteProviderComponent } from "./admin-console/providers/verify-recover-delete-provider.component";

const routes: Routes = [
  {
    path: "providers",
    canActivate: [deepLinkGuard()],
    loadChildren: () => ProvidersModule,
  },
  {
    path: "sm",
    canActivate: [deepLinkGuard()],
    loadChildren: async () =>
      (await import("./secrets-manager/secrets-manager.module")).SecretsManagerModule,
  },
  {
    // PAM end-user surfaces render inside the standard user-layout chrome (side nav),
    // mirroring their original OSS mount under UserLayoutComponent. Angular falls through
    // to the OSS empty-path route for any non-PAM child this group does not define.
    path: "",
    component: UserLayoutComponent,
    canActivate: [deepLinkGuard(), authGuard],
    children: [
      {
        path: "pam/approver-inbox",
        data: { titleId: "pamInboxTitle" } satisfies RouteDataProperties,
        canActivate: [canAccessFeature(FeatureFlag.Pam, true, "/vault")],
        loadChildren: () =>
          import("./pam/approver-inbox/approver-inbox.routes").then((m) => m.approverInboxRoutes),
      },
      {
        path: "leasing/requests/:id",
        data: { titleId: "pamAccessRequestTitle" } satisfies RouteDataProperties,
        canActivate: [canAccessFeature(FeatureFlag.Pam, true, "/vault")],
        loadComponent: () =>
          import("./pam/access-request-route/access-request-route.component").then(
            (m) => m.AccessRequestRouteComponent,
          ),
      },
    ],
  },
  {
    path: "verify-recover-delete-provider",
    component: AnonLayoutWrapperComponent,
    canActivate: [unauthGuardFn()],
    children: [
      {
        path: "",
        component: VerifyRecoverDeleteProviderComponent,
        data: { titleId: "deleteAccount" } satisfies RouteDataProperties,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
