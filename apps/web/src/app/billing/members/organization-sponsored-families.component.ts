import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Subject } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { SponsoredFamily } from "./types/sponsored-family";

@Component({
  selector: "app-organization-sponsored-families",
  templateUrl: "organization-sponsored-families.component.html",
})
export class OrganizationSponsoredFamiliesComponent implements OnInit, OnDestroy {
  loading = false;
  tabIndex = 0;

  @Input() sponsoredFamilies: SponsoredFamily[] = [];
  @Output() removeSponsorshipEvent = new EventEmitter<SponsoredFamily>();

  private _destroy = new Subject<void>();

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async ngOnInit() {
    this.loading = false;
  }

  get isSelfHosted(): boolean {
    return this.platformUtilsService.isSelfHost();
  }

  remove(sponsorship: SponsoredFamily) {
    this.removeSponsorshipEvent.emit(sponsorship);
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }
}
