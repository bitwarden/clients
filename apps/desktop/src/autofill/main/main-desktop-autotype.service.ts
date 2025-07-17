import { DesktopAutotypeService } from "../services/desktop-autotype.service";

export class MainDesktopAutotypeService {
  constructor(private desktopAutotypeService: DesktopAutotypeService) {}

  init() {
    this.desktopAutotypeService.autotypeEnabled$.subscribe((enabled) => {
      if (enabled) {
        this.enableAutotype();
      } else {
        this.disableAutotype();
      }
    });
  }

  // TODO: this will call into desktop native code
  private enableAutotype() {
    // eslint-disable-next-line no-console
    console.log("Enabling Autotype...");
  }

  // TODO: this will call into desktop native code
  private disableAutotype() {
    // eslint-disable-next-line no-console
    console.log("Disabling Autotype...");
  }
}
