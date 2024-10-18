import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject, skip, Subject, takeUntil } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { IntegrationId } from "@bitwarden/common/tools/integration";
import { UserId } from "@bitwarden/common/types/guid";
import {
  CredentialGeneratorService,
  getForwarderConfiguration,
  toCredentialGeneratorConfiguration,
} from "@bitwarden/generator-core";

import { completeOnAccountSwitch, toValidators } from "./util";

const Controls = Object.freeze({
  domain: "domain",
  token: "token",
  baseUrl: "baseUrl",
});

/** Options group for forwarder integrations */
@Component({
  selector: "tools-forwarder-settings",
  templateUrl: "forwarder-settings.component.html",
})
export class ForwarderSettingsComponent implements OnInit, OnDestroy {
  /** Instantiates the component
   *  @param accountService queries user availability
   *  @param generatorService settings and policy logic
   *  @param formBuilder reactive form controls
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
    private accountService: AccountService,
  ) {}

  /** Binds the component to a specific user's settings.
   *  When this input is not provided, the form binds to the active
   *  user
   */
  @Input()
  userId: UserId | null;

  @Input()
  forwarder: IntegrationId;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings$(...)` instead.
   */
  @Output()
  readonly onUpdated = new EventEmitter<unknown>();

  /** The template's control bindings */
  protected settings = this.formBuilder.group({
    [Controls.domain]: [""],
    [Controls.token]: [""],
    [Controls.baseUrl]: [""],
  });

  async ngOnInit() {
    const singleUserId$ = this.singleUserId$();
    const forwarder = getForwarderConfiguration(this.forwarder);

    // type erasure necessary because the configuration properties are
    // determined dynamically at runtime
    // FIXME: this can be eliminated by unifying the forwarder settings types;
    // see `ForwarderConfiguration<...>` for details.
    const configuration = toCredentialGeneratorConfiguration<any>(forwarder);
    this.displayDomain = configuration.request.includes("domain");
    this.displayToken = configuration.request.includes("token");
    this.displayBaseUrl = configuration.request.includes("baseUrl");

    // bind settings to the UI
    const settings = await this.generatorService.settings(configuration, { singleUserId$ });
    settings.pipe(takeUntil(this.destroyed$)).subscribe((s) => {
      // skips reactive event emissions to break a subscription cycle
      this.settings.patchValue(s, { emitEvent: false });
    });

    // bind policy to the template
    this.generatorService
      .policy$(configuration, { userId$: singleUserId$ })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(({ constraints }) => {
        for (const name in Controls) {
          const control = this.settings.get(name);
          if (configuration.request.includes(name as any)) {
            control.enable({ emitEvent: false });
            control.setValidators(
              // the configuration's type erasure affects `toValidators` as well
              toValidators(name, configuration, constraints),
            );
          } else {
            control.disable({ emitEvent: false });
            control.clearValidators();
          }
        }
      });

    // the first emission is the current value; subsequent emissions are updates
    settings.pipe(skip(1), takeUntil(this.destroyed$)).subscribe(this.onUpdated);

    // now that outputs are set up, connect inputs
    this.settings.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe(settings);
  }

  protected displayDomain: boolean;
  protected displayToken: boolean;
  protected displayBaseUrl: boolean;

  private singleUserId$() {
    // FIXME: this branch should probably scan for the user and make sure
    // the account is unlocked
    if (this.userId) {
      return new BehaviorSubject(this.userId as UserId).asObservable();
    }

    return this.accountService.activeAccount$.pipe(
      completeOnAccountSwitch(),
      takeUntil(this.destroyed$),
    );
  }

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.complete();
  }
}
