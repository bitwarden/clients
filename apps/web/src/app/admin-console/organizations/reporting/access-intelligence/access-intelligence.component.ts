/* eslint-disable no-restricted-imports -- Prototype feature using licensed services */
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
import { ActivatedRoute } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccessIntelligenceClientService } from "@bitwarden/bit-common/dirt/reports/access-intelligence";
import {
  AccessIntelligenceState,
  CipherHealthResult,
  isAtRiskCipher,
} from "@bitwarden/common/dirt/reports/access-intelligence";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  BadgeComponent,
  ButtonModule,
  IconModule,
  ProgressModule,
  TableModule,
} from "@bitwarden/components";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
/* eslint-enable no-restricted-imports */

@Component({
  selector: "app-access-intelligence",
  templateUrl: "./access-intelligence.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    HeaderModule,
    BadgeComponent,
    ButtonModule,
    IconModule,
    ProgressModule,
    TableModule,
  ],
  providers: [AccessIntelligenceClientService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessIntelligenceComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  protected readonly service = inject(AccessIntelligenceClientService);

  // Expose service signals to template
  readonly state = this.service.state;
  readonly error = this.service.error;
  readonly cipherProgress = this.service.cipherProgress;
  readonly healthProgress = this.service.healthProgress;
  readonly memberProgress = this.service.memberProgress;
  readonly result = this.service.result;

  // Expose constants for template access
  readonly AccessIntelligenceState = AccessIntelligenceState;

  // Component initialization state
  protected readonly initialized = signal(false);

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const organizationId = params["organizationId"] as OrganizationId;
      if (organizationId) {
        this.service.start(organizationId);
        this.initialized.set(true);
      }
    });
  }

  /** Start processing - run the report */
  protected runReport(): void {
    const organizationId = this.route.snapshot.params["organizationId"] as OrganizationId;
    if (organizationId) {
      this.service.start(organizationId);
    }
  }

  /** Check if processing is currently running */
  protected isProcessing(): boolean {
    const currentState = this.state();
    return (
      currentState !== AccessIntelligenceState.Idle &&
      currentState !== AccessIntelligenceState.Complete &&
      currentState !== AccessIntelligenceState.Error
    );
  }

  /** Check if progress section should be shown */
  protected showProgress(): boolean {
    return this.isProcessing() || this.state() === AccessIntelligenceState.Complete;
  }

  /** Calculate overall progress percentage */
  protected getOverallProgress(): number {
    const currentState = this.state();

    switch (currentState) {
      case AccessIntelligenceState.Idle:
        return 0;
      case AccessIntelligenceState.LoadingCiphers:
        return this.cipherProgress().percent * 0.1; // 0-10%
      case AccessIntelligenceState.ProcessingHealth:
        return 10 + this.healthProgress().percent * 0.5; // 10-60%
      case AccessIntelligenceState.LoadingOrganizationData:
        return 60 + 10; // 60-70%
      case AccessIntelligenceState.MappingAccess:
        return 70 + this.memberProgress().percent * 0.3; // 70-100%
      case AccessIntelligenceState.Complete:
        return 100;
      default:
        return 0;
    }
  }

  /** Get a human-readable progress message */
  protected getProgressMessage(): string {
    const currentState = this.state();

    switch (currentState) {
      case AccessIntelligenceState.LoadingCiphers:
        return "Loading ciphers...";
      case AccessIntelligenceState.ProcessingHealth:
        return `Checking password health (${this.healthProgress().current}/${this.healthProgress().total})...`;
      case AccessIntelligenceState.LoadingOrganizationData:
        return "Loading organization data...";
      case AccessIntelligenceState.MappingAccess:
        return `Mapping member access (${this.memberProgress().current}/${this.memberProgress().total})...`;
      case AccessIntelligenceState.Complete:
        return "Analysis complete";
      case AccessIntelligenceState.Error:
        return "An error occurred";
      default:
        return "";
    }
  }

  /** Check if a cipher is at risk */
  protected isCipherAtRisk(health: CipherHealthResult | null): boolean {
    if (!health) {
      return false;
    }
    return isAtRiskCipher(health);
  }
}
