import { Component, Input } from "@angular/core";

@Component({
  selector: "sm-section",
  templateUrl: "./section.component.html",
  standalone: false,
})
export class SectionComponent {
  @Input() open = true;

  /**
   * UID for `[attr.aria-controls]`
   */
  protected contentId = Math.random().toString(36).substring(2);

  protected toggle() {
    this.open = !this.open;
  }
}
