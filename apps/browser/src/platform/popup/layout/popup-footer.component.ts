import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "popup-footer",
  templateUrl: "popup-footer.component.html",
  imports: [],
})
export class PopupFooterComponent {}
