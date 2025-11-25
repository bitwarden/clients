import { DatePipe } from "@angular/common";
import { Component, ChangeDetectionStrategy } from "@angular/core";

@Component({
  selector: "app-send-v2",
  imports: [DatePipe],
  templateUrl: "send-v2.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendV2Component {}
