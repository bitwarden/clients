import { DatePipe } from "@angular/common";
import { Component, ChangeDetectionStrategy } from "@angular/core";

@Component({
  selector: "app-desktop-sends-v2",
  imports: [DatePipe],
  templateUrl: "sends.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendsComponent {}
