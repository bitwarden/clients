import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "magnify-root",
  template: `<p>Magnify</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  constructor() {
    // eslint-disable-next-line no-console
    console.log("chrome version" + window.ipc.chrome());
  }
}
