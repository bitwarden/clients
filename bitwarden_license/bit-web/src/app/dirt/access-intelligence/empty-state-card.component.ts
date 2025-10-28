import { CommonModule } from "@angular/common";
import { Component, Input, isDevMode, OnInit } from "@angular/core";

import { Icon } from "@bitwarden/assets/svg";
import { ButtonModule, IconModule } from "@bitwarden/components";

@Component({
  selector: "empty-state-card",
  templateUrl: "./empty-state-card.component.html",
  imports: [CommonModule, IconModule, ButtonModule],
})
export class EmptyStateCardComponent implements OnInit {
  @Input() icon: Icon | null = null;
  @Input() videoSrc: string | null = null;
  @Input() title: string = "";
  @Input() description: string = "";
  @Input() benefits: [string, string][] = [];
  @Input() buttonText: string = "";
  @Input() buttonAction: (() => void) | null = null;
  @Input() buttonIcon?: string;

  ngOnInit(): void {
    if (!this.title && isDevMode()) {
      // eslint-disable-next-line no-console
      console.warn("EmptyStateCardComponent: title is required for proper display");
    }
  }
}
