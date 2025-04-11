import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Subject } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-organization-sponsored-families",
  templateUrl: "organization-sponsored-families.component.html",
})
export class OrganizationSponsoredFamiliesComponent implements OnInit, OnDestroy {
  loading = false;
  tabIndex: number;

  @Input() sponsoredFamilies: any;
  @Output() removeSponsorshipEvent = new EventEmitter();

  private _destroy = new Subject<void>();

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async ngOnInit() {
    this.loading = false;
  }

  get isSelfHosted(): boolean {
    return this.platformUtilsService.isSelfHost();
  }

  remove(sponsorship: any) {
    this.removeSponsorshipEvent.emit(sponsorship);
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }
}
