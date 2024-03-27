import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { deepLinkGuard } from "@bitwarden/web-vault/app/auth/guards/deep-link.guard";

import { ProvidersModule } from "./admin-console/providers/providers.module";

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
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
