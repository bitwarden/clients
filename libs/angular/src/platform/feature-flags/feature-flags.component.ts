import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { map, tap } from "rxjs";

import { AllowedFeatureFlagTypes } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  FormFieldModule,
  InputModule,
  SearchModule,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-feature-flags",
  templateUrl: "./feature-flags.component.html",
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    I18nPipe,
    FormsModule,
    FormFieldModule,
    InputModule,
    SearchModule,
  ],
})
export class FeatureFlagsComponent implements OnInit {
  loading = true;
  tableDataSource = new TableDataSource<{ key: string; value: AllowedFeatureFlagTypes }>();

  featureStates: { [key: string]: AllowedFeatureFlagTypes } | undefined = undefined;

  searchText = "";

  constructor(
    private destroyRef: DestroyRef,
    private configService: ConfigService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    this.configService.featureStates$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((states) => {
          this.featureStates = states;
        }),
        map((states) => {
          if (!states) {
            return [];
          }

          // Convert the feature states object into an array of key-value pairs
          return Object.entries(states).map(([key, value]) => ({
            key,
            value,
          }));
        }),
      )
      .subscribe((featureStates) => {
        this.tableDataSource.data = featureStates;
        this.loading = false;
      });
  }

  onSearchTextChanged(searchText: string) {
    this.searchText = searchText;
    this.tableDataSource.filter = searchText;
  }

  refresh() {
    this.configService.refreshServerConfig();
  }

  copyJsonToClipboard() {
    this.platformUtilsService.copyToClipboard(JSON.stringify(this.featureStates));
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("copySuccessful"),
    });
  }
}
