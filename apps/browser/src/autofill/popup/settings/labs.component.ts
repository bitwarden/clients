import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LabsSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/labs-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "labs.component.html",
  standalone: true,
  imports: [
    CardComponent,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    FormsModule,
    ItemModule,
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    RouterModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class LabsComponent implements OnInit {
  /*
   * Default values set here are used in component state operations
   * until corresponding stored settings have loaded on init.
   */
  protected improvedFieldQualificationForInlineMenuEnabled: boolean = false;
  protected additionalInlineMenuCipherTypesEnabled: boolean = false;
  protected designRefreshEnabled: boolean = false;

  constructor(
    private i18nService: I18nService,
    private labsSettingsService: LabsSettingsServiceAbstraction,
  ) {}

  async ngOnInit() {
    await this.labsSettingsService.checkUserSettingClearStatus();

    // Note, we're getting the user setting values, not the values resolved against
    // feature flags with the labsSettingsService getter methods
    this.improvedFieldQualificationForInlineMenuEnabled = await firstValueFrom(
      this.labsSettingsService.improvedFieldQualificationForInlineMenuEnabled$,
    );

    this.additionalInlineMenuCipherTypesEnabled = await firstValueFrom(
      this.labsSettingsService.additionalInlineMenuCipherTypesEnabled$,
    );

    this.designRefreshEnabled = await firstValueFrom(
      this.labsSettingsService.designRefreshEnabled$,
    );
  }

  async updateImprovedFieldQualificationForInlineMenuEnabled() {
    await this.labsSettingsService.setImprovedFieldQualificationForInlineMenuEnabled(
      this.improvedFieldQualificationForInlineMenuEnabled,
    );
  }

  async updateAdditionalInlineMenuCipherTypesEnabled() {
    await this.labsSettingsService.setAdditionalInlineMenuCipherTypesEnabled(
      this.additionalInlineMenuCipherTypesEnabled,
    );
  }

  async updateDesignRefreshEnabled() {
    await this.labsSettingsService.setDesignRefreshEnabled(this.designRefreshEnabled);
  }
}
