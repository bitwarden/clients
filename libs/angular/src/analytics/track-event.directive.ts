import { Directive, HostListener, inject, Input } from "@angular/core";

import { AnalyticsService } from "./analytics.service";

@Directive({
  selector: "[track-event]",
  standalone: true,
})
export class TrackEventDirective {
  private analyticsService = inject(AnalyticsService);

  @Input({
    alias: "track-event",
    required: true,
  })
  eventName!: string;

  @HostListener("click")
  handleClick() {
    this.analyticsService.trackEvent(this.eventName);
  }
}
