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
  // OSS registers no "pam" route under the user layout — this is additive, commercial-only.
  {
    path: "",
    component: UserLayoutComponent,
    canActivate: [deepLinkGuard(), authGuard],
    children: [
      {
        path: "pam",
        canActivate: [canAccessFeature(FeatureFlag.Pam)],
        loadChildren: () =>
          import("./pam/my-access/my-access-routing.module").then((m) => m.MyAccessRoutingModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
