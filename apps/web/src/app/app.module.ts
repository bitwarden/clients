import { DragDropModule } from "@angular/cdk/drag-drop";
import { LayoutModule } from "@angular/cdk/layout";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { InfiniteScrollModule } from "ngx-infinite-scroll";

import { AppComponent } from "./app.component";
import { CoreModule } from "./core";
import { OssRoutingModule } from "./oss-routing.module";
import { OssModule } from "./oss.module";
import { WildcardRoutingModule } from "./wildcard-routing.module";

/**
 * This is the AppModule for the OSS version of Bitwarden.
 * `bitwarden_license/bit-web/app.module.ts` contains the commercial version.
 *
 * You probably do not want to modify this file. Consider editing `oss.module.ts` instead.
 */
@NgModule({
  imports: [
    OssModule,
    BrowserAnimationsModule,
    FormsModule,
    CoreModule,
    InfiniteScrollModule,
    DragDropModule,
    LayoutModule,
    OssRoutingModule,
    WildcardRoutingModule, // Needs to be last to catch all non-existing routes
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
