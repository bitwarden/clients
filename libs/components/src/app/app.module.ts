import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";

/**
 * Root module for the component library's Storybook application.
 */
@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, CommonModule],
  providers: [{ provide: "WINDOW", useValue: window }],
  bootstrap: [AppComponent],
})
export class AppModule {}
