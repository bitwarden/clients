import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { LayoutModule } from "@angular/cdk/layout";
import { OverlayModule, OVERLAY_DEFAULT_CONFIG } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DialogModule,
  AvatarModule,
  ButtonModule,
  FormFieldModule,
  ToastModule,
  CalloutModule,
  LinkModule,
} from "@bitwarden/components";

import { PopupFocusWrapDirective } from "../platform/popup/components/popup-focus-wrap.directive";
import { PopupTabNavigationComponent } from "../platform/popup/layout/popup-tab-navigation.component";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ServicesModule } from "./services/services.module";
import { TabsV2Component } from "./tabs-v2.component";

// Register the locales for the application
import "../platform/popup/locales";

/**
 * `imports` is deliberately minimal: an NgModule's imports are eager, so listing a routed
 * screen here pins it into the startup bundle and defeats the `loadComponent` routes in
 * AppRoutingModule. Only add a component if AppComponent or TabsV2Component uses it in a
 * template; routed screens belong in the router.
 */
@NgModule({
  imports: [
    A11yModule,
    AppRoutingModule,
    ToastModule.forRoot({
      maxOpened: 2,
      autoDismiss: true,
      closeButton: true,
      positionClass: "toast-top-full-width",
    }),
    BrowserAnimationsModule,
    BrowserModule,
    DragDropModule,
    FormsModule,
    JslibModule,
    LayoutModule,
    OverlayModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
    DialogModule,
    AvatarModule,
    ButtonModule,
    PopupFocusWrapDirective,
    PopupTabNavigationComponent,
    FormFieldModule,
    CalloutModule,
    LinkModule,
  ],
  declarations: [AppComponent, TabsV2Component],
  exports: [CalloutModule],
  providers: [
    CurrencyPipe,
    DatePipe,
    { provide: OVERLAY_DEFAULT_CONFIG, useValue: { usePopover: false } },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
