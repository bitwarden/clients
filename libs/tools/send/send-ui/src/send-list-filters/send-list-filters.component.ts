import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ChipSelectComponent } from "@bitwarden/components";

import { SendListFiltersService } from "../services/send-list-filters.service";

@Component({
  standalone: true,
  selector: "app-send-list-filters",
  templateUrl: "./send-list-filters.component.html",
  imports: [CommonModule, JslibModule, ChipSelectComponent, ReactiveFormsModule],
})
export class SendListFiltersComponent implements OnDestroy {
  protected filterForm = this.sendListFiltersService.filterForm;
  protected sendTypes = this.sendListFiltersService.sendTypes;
  protected canAccessPremium$: Observable<boolean>;

  constructor(
    private sendListFiltersService: SendListFiltersService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    this.canAccessPremium$ = billingAccountProfileStateService.hasPremiumFromAnySource$;
  }

  ngOnDestroy(): void {
    this.sendListFiltersService.resetFilterForm();
  }
}
