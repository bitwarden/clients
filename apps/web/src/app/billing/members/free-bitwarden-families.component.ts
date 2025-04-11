import { DialogRef } from "@angular/cdk/dialog";
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { FreeFamiliesPolicyService } from "../services/free-families-policy.service";

import {
  AddSponsorshipDialogComponent,
  AddSponsorshipDialogResult,
} from "./add-sponsorship-dialog.component";

@Component({
  selector: "app-free-bitwarden-families",
  templateUrl: "free-bitwarden-families.component.html",
})
export class FreeBitwardenFamiliesComponent implements OnInit {
  tabIndex: number;
  sponsoredFamilies: any[] = [];

  constructor(
    private router: Router,
    private dialogService: DialogService,
    private freeFamiliesPolicyService: FreeFamiliesPolicyService,
  ) {}

  async ngOnInit() {
    await this.preventAccessToFreeFamiliesPage();
  }

  async addSponsorship() {
    const addSponsorshipDialogRef: DialogRef<AddSponsorshipDialogResult> =
      AddSponsorshipDialogComponent.open(this.dialogService);

    const dialogRef = await firstValueFrom(addSponsorshipDialogRef.closed);

    const addedSponsorship = dialogRef.value;

    if (addedSponsorship) {
      this.sponsoredFamilies = [addedSponsorship, ...this.sponsoredFamilies];
    }
  }

  removeSponsorhip(sponsorship: any) {
    const index = this.sponsoredFamilies.findIndex(
      (e) => e.sponsorshipEmail == sponsorship.sponsorshipEmail,
    );
    this.sponsoredFamilies.splice(index, 1);
  }

  private async preventAccessToFreeFamiliesPage() {
    const showFreeFamiliesPage = await firstValueFrom(
      this.freeFamiliesPolicyService.showFreeFamilies$,
    );

    if (!showFreeFamiliesPage) {
      await this.router.navigate(["/"]);
      return;
    }
  }
}
