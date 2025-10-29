import { Component } from "@angular/core";

@Component({
  selector: "bit-card-content",
  template: `<div class="tw-p-4 [@media(min-width:650px)]:tw-p-6"><ng-content></ng-content></div>`,
})
export class CardContentComponent {}
