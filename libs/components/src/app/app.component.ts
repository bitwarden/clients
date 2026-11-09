import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
  standalone: false,
})
export class AppComponent {
  readonly title = "components";
}
