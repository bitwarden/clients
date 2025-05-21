import { TemplatePortal, CdkPortalOutlet } from "@angular/cdk/portal";
import { Component, Input } from "@angular/core";

@Component({
  selector: "vault-carousel-content",
  templateUrl: "carousel-content.component.html",
  standalone: true,
  imports: [CdkPortalOutlet],
})
export class VaultCarouselContentComponent {
  /** Content to be displayed for the carousel. */
  @Input({ required: true }) content!: TemplatePortal;
}
