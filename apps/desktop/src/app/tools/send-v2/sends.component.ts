import { DatePipe } from "@angular/common";
import { Component, ChangeDetectionStrategy } from "@angular/core";

@Component({
  selector: "app-sends-v2",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "sends.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendsComponent {}
