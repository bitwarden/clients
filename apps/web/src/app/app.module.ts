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
import { SendComponent } from "./tools/send/send.component";
import { WildcardRoutingModule } from "./wildcard-routing.module";

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
    SendComponent,
    WildcardRoutingModule, // Needs to be last to catch all non-existing routes
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
