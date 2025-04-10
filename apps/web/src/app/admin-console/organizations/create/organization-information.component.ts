// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { UntypedFormGroup } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

@Component({
  selector: "app-org-info",
  templateUrl: "organization-information.component.html",
})
export class OrganizationInformationComponent implements OnInit {
  @Input() nameOnly = false;
  @Input() createOrganization = true;
  @Input() isProvider = false;
  @Input() acceptingSponsorship = false;
  @Input() formGroup: UntypedFormGroup;
  @Output() changedBusinessOwned = new EventEmitter<void>();

  constructor(private accountService: AccountService) {}

  async ngOnInit(): Promise<void> {
    if (this.formGroup?.controls?.billingEmail?.value) {
      return;
    }

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    if (activeAccount?.email) {
      this.formGroup.controls.billingEmail.setValue(activeAccount.email);
    }
  }
}
