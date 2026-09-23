import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { TabBodyComponent } from "./tab-group/tab-body.component";
import { TabGroupComponent } from "./tab-group/tab-group.component";
import { TabComponent } from "./tab-group/tab.component";
import { TabLinkComponent } from "./tab-nav-bar/tab-link.component";
import { TabNavBarComponent } from "./tab-nav-bar/tab-nav-bar.component";

@NgModule({
  imports: [
    CommonModule,
    TabGroupComponent,
    TabComponent,
    TabNavBarComponent,
    TabLinkComponent,
    TabBodyComponent,
  ],
  exports: [TabGroupComponent, TabComponent, TabNavBarComponent, TabLinkComponent],
})
export class TabsModule {}
