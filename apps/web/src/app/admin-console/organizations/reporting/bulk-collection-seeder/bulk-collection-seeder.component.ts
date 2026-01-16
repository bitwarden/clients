import { CommonModule } from "@angular/common";
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService, CollectionAdminView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  FormFieldModule,
  ProgressModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

interface CollectionCreationResult {
  name: string;
  success: boolean;
  error?: string;
  id?: CollectionId;
}

@Component({
  selector: "app-bulk-collection-seeder",
  templateUrl: "./bulk-collection-seeder.component.html",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    HeaderModule,
    ButtonModule,
    FormFieldModule,
    ProgressModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkCollectionSeederComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private collectionAdminService = inject(CollectionAdminService);
  private accountService = inject(AccountService);

  protected organizationId: OrganizationId | null = null;
  protected collectionNames = "";
  protected readonly isProcessing = signal(false);
  protected readonly progress = signal(0);
  protected readonly progressMessage = signal("");
  protected readonly results = signal<CollectionCreationResult[]>([]);
  protected readonly hasRun = signal(false);

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.organizationId = params["organizationId"] as OrganizationId;
    });
  }

  protected async createCollections(): Promise<void> {
    if (!this.organizationId || !this.collectionNames.trim()) {
      return;
    }

    const names = this.collectionNames
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (names.length === 0) {
      return;
    }

    this.isProcessing.set(true);
    this.progress.set(0);
    this.results.set([]);
    this.hasRun.set(true);

    const results: CollectionCreationResult[] = [];
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      this.progressMessage.set(`Creating collection ${i + 1} of ${names.length}: ${name}`);
      this.progress.set(Math.round(((i + 1) / names.length) * 100));

      try {
        const collectionView = new CollectionAdminView({
          id: null as unknown as CollectionId,
          organizationId: this.organizationId,
          name: name,
        });
        collectionView.groups = [];
        collectionView.users = [];

        const response = await this.collectionAdminService.create(collectionView, userId);

        results.push({
          name,
          success: true,
          id: response.id,
        });
      } catch (error) {
        results.push({
          name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      this.results.set([...results]);
    }

    this.progressMessage.set(
      `Completed: ${results.filter((r) => r.success).length} of ${names.length} collections created`,
    );
    this.isProcessing.set(false);
  }

  protected get successCount(): number {
    return this.results().filter((r) => r.success).length;
  }

  protected get failureCount(): number {
    return this.results().filter((r) => !r.success).length;
  }

  protected clearResults(): void {
    this.results.set([]);
    this.hasRun.set(false);
    this.progress.set(0);
    this.progressMessage.set("");
  }
}
