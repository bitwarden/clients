import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, Inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";
import { DeDuplicateService } from "../../vault/services/de-duplicate.service";

@Component({
  selector: "app-de-duplicate",
  standalone: true,
  imports: [CommonModule, SharedModule, HeaderModule, ButtonModule, CalloutModule, I18nPipe],
  templateUrl: "./de-duplicate.component.html",
})
export class DeDuplicateComponent {
  loading = false;
  callout: { type: "success" | "warning"; title?: string; message: string } | null = null;

  constructor(
    @Inject(DeDuplicateService) private deDuplicateService: DeDuplicateService,
    private i18nService: I18nService,
    private accountService: AccountService,
    private cdr: ChangeDetectorRef,
  ) {}

  findDuplicates = async () => {
    this.callout = null;

    // Allow progress spinner to appear on button
    await new Promise<void>((r) => setTimeout(r, 100));

    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const result = await this.deDuplicateService.findAndHandleDuplicates(userId);

      if (result.setsFound === 0) {
        this.callout = {
          type: "success",
          title: this.i18nService.t("deDuplicationComplete"),
          message: this.i18nService.t("noDuplicatesFound"),
        };
      } else {
        const trashed = result.trashed ?? 0;
        const permanentlyDeleted = result.permanentlyDeleted ?? 0;
        const parts: string[] = [];
        parts.push(`${trashed} ${this.i18nService.t("itemsTrashed")}`);
        parts.push(`${permanentlyDeleted} ${this.i18nService.t("itemsPermanentlyDeleted")}`);
        this.callout = {
          type: "success",
          title: this.i18nService.t("deDuplicationComplete"),
          message: parts.join(", ") + ".",
        };
      }
    } catch (e) {
      const message = this.i18nService.t("duplicateError");
      this.callout = {
        type: "warning",
        title: message,
        message: `${message}: ${e}`,
      };
    } finally {
      this.cdr.markForCheck?.();
    }
  };
}
