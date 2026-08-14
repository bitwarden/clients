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
  {
    // Mounted on "pam" rather than an empty-path shell: this module is registered before
    // OssRoutingModule, so an empty-path route here matches "/" and its authGuard fires
    // before the root redirectGuard can send anonymous users to /login.
    path: "pam",
    component: UserLayoutComponent,
    canActivate: [deepLinkGuard(), authGuard, canAccessFeature(FeatureFlag.Pam)],
    loadChildren: () =>
      import("./pam/access-requests/access-requests-routing.module").then(
        (m) => m.AccessRequestsRoutingModule,
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
