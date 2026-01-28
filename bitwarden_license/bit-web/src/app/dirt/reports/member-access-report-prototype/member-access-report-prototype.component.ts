import { CommonModule } from "@angular/common";
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subject, debounceTime, firstValueFrom, takeUntil } from "rxjs";

import {
  CipherAccessMappingService,
  EffectivePermissionLevel,
  MemberAccessReportService,
  MemberAccessReportState,
  MemberAccessSummary,
} from "@bitwarden/bit-common/dirt/reports/risk-insights";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  BadgeModule,
  DialogService,
  IconModule,
  ProgressModule,
  SearchModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { MemberAccessDetailDialogComponent } from "./member-access-detail-dialog.component";

@Component({
  selector: "app-member-access-report-prototype",
  templateUrl: "member-access-report-prototype.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    SharedModule,
    SearchModule,
    HeaderModule,
    TableModule,
    BadgeModule,
    IconModule,
    ProgressModule,
    ReactiveFormsModule,
  ],
  providers: [CipherAccessMappingService, MemberAccessReportService],
})
export class MemberAccessReportPrototypeComponent implements OnInit, OnDestroy {
  protected dataSource = new TableDataSource<MemberAccessSummary>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected organizationId: OrganizationId;
  protected currentUserId: UserId;

  // Loading state
  protected state: MemberAccessReportState = MemberAccessReportState.Idle;
  protected progressPercent = 0;
  protected processedCipherCount = 0;
  protected totalCipherCount = 0;
  protected errorMessage: string | null = null;

  // Timing info
  protected loadStartTime: number = 0;
  protected loadEndTime: number = 0;

  // Constants for template
  protected readonly MemberAccessReportState = MemberAccessReportState;
  protected readonly EffectivePermissionLevel = EffectivePermissionLevel;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly accountService: AccountService,
    private readonly memberAccessReportService: MemberAccessReportService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly dialogService: DialogService,
  ) {
    // Connect the search input to the table dataSource filter
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    const params = await firstValueFrom(this.route.params);
    this.organizationId = params.organizationId;

    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account) {
      this.currentUserId = account.id;
    }

    // Auto-start loading
    this.startLoading();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startLoading() {
    if (!this.organizationId || !this.currentUserId) {
      this.errorMessage = "Organization ID or User ID not available";
      this.state = MemberAccessReportState.Error;
      this.changeDetectorRef.markForCheck();
      return;
    }

    // Reset state
    this.state = MemberAccessReportState.LoadingCiphers;
    this.progressPercent = 0;
    this.processedCipherCount = 0;
    this.totalCipherCount = 0;
    this.errorMessage = null;
    this.dataSource.data = [];
    this.loadStartTime = performance.now();
    this.loadEndTime = 0;
    this.changeDetectorRef.markForCheck();

    this.memberAccessReportService
      .getMemberAccessSummariesProgressive$(this.organizationId, this.currentUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.state = result.state;
          this.progressPercent = result.progressPercent;
          this.processedCipherCount = result.processedCipherCount;
          this.totalCipherCount = result.totalCipherCount;
          this.dataSource.data = result.members;

          if (result.state === MemberAccessReportState.Complete) {
            this.loadEndTime = performance.now();
          }

          if (result.error) {
            this.errorMessage = result.error;
          }

          this.changeDetectorRef.markForCheck();
        },
        error: (err: unknown) => {
          this.state = MemberAccessReportState.Error;
          this.errorMessage = err instanceof Error ? err.message : "An error occurred";
          this.loadEndTime = performance.now();
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  get loadTimeMs(): number {
    if (this.loadEndTime > 0 && this.loadStartTime > 0) {
      return Math.round(this.loadEndTime - this.loadStartTime);
    }
    return 0;
  }

  get isLoading(): boolean {
    return (
      this.state === MemberAccessReportState.LoadingCiphers ||
      this.state === MemberAccessReportState.ProcessingMembers
    );
  }

  get isComplete(): boolean {
    return this.state === MemberAccessReportState.Complete;
  }

  get isError(): boolean {
    return this.state === MemberAccessReportState.Error;
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

  onMemberRowClick(member: MemberAccessSummary) {
    MemberAccessDetailDialogComponent.open(this.dialogService, {
      organizationId: this.organizationId,
      currentUserId: this.currentUserId,
      targetUserId: member.userId,
      memberEmail: member.email,
      memberName: member.name,
    });
  }
}
