import { Component, ChangeDetectionStrategy } from "@angular/core";

@Component({
  selector: "app-sends-v2",
  standalone: true,
  imports: [],
  template: "<p>Sends V2 Component</p>",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendsComponent {}
