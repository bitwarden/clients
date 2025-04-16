import { DialogRef } from "@angular/cdk/dialog";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { FreeFamiliesPolicyService } from "../services/free-families-policy.service";

import {
  AddSponsorshipDialogComponent,
  AddSponsorshipDialogResult,
} from "./add-sponsorship-dialog.component";
import { SponsoredFamily } from "./types/sponsored-family.types";

@Component({
  selector: "app-free-bitwarden-families",
  templateUrl: "free-bitwarden-families.component.html",
})
export class FreeBitwardenFamiliesComponent implements OnInit {
  tabIndex = 0;
  sponsoredFamilies: SponsoredFamily[] = [];
  organizationId: string;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private freeFamiliesPolicyService: FreeFamiliesPolicyService,
  ) {}

  async ngOnInit() {
    await this.preventAccessToFreeFamiliesPage();

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizationId = params.organizationId;
    });
  }

  async addSponsorship() {
    const addSponsorshipDialogRef: DialogRef<AddSponsorshipDialogResult> =
      AddSponsorshipDialogComponent.open(this.dialogService, {
        data: { organizationId: this.organizationId },
      });

    const dialogRef = await firstValueFrom(addSponsorshipDialogRef.closed);

    if (dialogRef?.value) {
      this.sponsoredFamilies = [dialogRef.value, ...this.sponsoredFamilies];
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
