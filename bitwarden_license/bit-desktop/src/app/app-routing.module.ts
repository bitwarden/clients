import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RouteDataProperties {}

const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
