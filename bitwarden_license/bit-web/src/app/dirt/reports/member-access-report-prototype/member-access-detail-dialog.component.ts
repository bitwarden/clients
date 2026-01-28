import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Inject,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import {
  CipherAccessMappingService,
  EffectivePermissionLevel,
  MemberAccessDetailView,
  MemberAccessReportService,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

export interface MemberAccessDetailDialogData {
  organizationId: OrganizationId;
  currentUserId: UserId;
  targetUserId: string;
  memberEmail: string;
  memberName: string | null;
}

@Component({
  selector: "app-member-access-detail-dialog",
  templateUrl: "member-access-detail-dialog.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule, ButtonModule, BadgeModule, TypographyModule],
  providers: [CipherAccessMappingService, MemberAccessReportService],
})
export class MemberAccessDetailDialogComponent implements OnInit {
  protected loading = true;
  protected detailView: MemberAccessDetailView | null = null;

  protected readonly EffectivePermissionLevel = EffectivePermissionLevel;

  constructor(
    @Inject(DIALOG_DATA) protected dialogData: MemberAccessDetailDialogData,
    private readonly memberAccessReportService: MemberAccessReportService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit() {
    this.memberAccessReportService
      .getMemberAccessDetail$(
        this.dialogData.organizationId,
        this.dialogData.currentUserId,
        this.dialogData.targetUserId,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detailView = detail;
          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  static open(dialogService: DialogService, data: MemberAccessDetailDialogData) {
    return dialogService.open(MemberAccessDetailDialogComponent, { data });
  }

  getPermissionBadgeVariant(
    permission: EffectivePermissionLevel,
  ): "primary" | "secondary" | "success" | "danger" | "warning" | "info" {
    switch (permission) {
      case EffectivePermissionLevel.Manage:
        return "success";
      case EffectivePermissionLevel.Edit:
        return "primary";
      case EffectivePermissionLevel.ViewOnly:
        return "info";
      case EffectivePermissionLevel.HidePasswords:
        return "warning";
      default:
        return "secondary";
    }
  }

  getPermissionLabel(permission: EffectivePermissionLevel): string {
    switch (permission) {
      case EffectivePermissionLevel.Manage:
        return "Manage";
      case EffectivePermissionLevel.Edit:
        return "Edit";
      case EffectivePermissionLevel.ViewOnly:
        return "View Only";
      case EffectivePermissionLevel.HidePasswords:
        return "Hide Passwords";
      default:
        return "Unknown";
    }
  }
}
