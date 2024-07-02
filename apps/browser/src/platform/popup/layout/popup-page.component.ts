import { NgIf } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  selector: "popup-page",
  templateUrl: "popup-page.component.html",
  standalone: true,
  host: {
    class: "tw-h-full tw-flex tw-flex-col tw-flex-1 tw-overflow-y-auto",
  },
  imports: [NgIf],
})
export class PopupPageComponent {}
