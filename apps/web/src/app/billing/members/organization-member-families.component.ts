import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { Subject } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { SponsoredFamily } from "./types/sponsored-family";

@Component({
  selector: "app-organization-member-families",
  templateUrl: "organization-member-families.component.html",
})
export class OrganizationMemberFamiliesComponent implements OnInit, OnDestroy {
  tabIndex = 0;
  loading = false;

  @Input() memberFamilies: SponsoredFamily[] = [];

  private _destroy = new Subject<void>();

  constructor(private platformUtilsService: PlatformUtilsService) {}

  async ngOnInit() {
    this.loading = false;
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  get isSelfHosted(): boolean {
    return this.platformUtilsService.isSelfHost();
  }
}
