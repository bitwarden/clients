import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { unauthGuardFn } from "@bitwarden/angular/auth/guards";
import { AnonLayoutWrapperComponent } from "@bitwarden/components";
import { deepLinkGuard } from "@bitwarden/web-vault/app/auth/guards/deep-link/deep-link.guard";
import { RouteDataProperties } from "@bitwarden/web-vault/app/core";

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
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
