// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { map, ReplaySubject, skip, Subject, switchAll, takeUntil, withLatestFrom } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { IntegrationId } from "@bitwarden/common/tools/integration";
import {
  CredentialGeneratorConfiguration,
  CredentialGeneratorService,
  getForwarderConfiguration,
  NoPolicy,
  toCredentialGeneratorConfiguration,
} from "@bitwarden/generator-core";

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
export class ForwarderSettingsComponent implements OnInit, OnChanges, OnDestroy {
  /** Instantiates the component
   *  @param accountService queries user availability
   *  @param generatorService settings and policy logic
   *  @param formBuilder reactive form controls
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
  ) {}

  /** Binds the component to a specific user's settings.
   */
  @Input({ required: true })
  account: Account;

  protected account$ = new ReplaySubject<Account>(1);

  @Input({ required: true })
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

  private forwarderId$ = new ReplaySubject<IntegrationId>(1);

  async ngOnInit() {
    const forwarder$ = new ReplaySubject<CredentialGeneratorConfiguration<any, NoPolicy>>(1);
    this.forwarderId$
      .pipe(
        map((id) => getForwarderConfiguration(id)),
        // type erasure necessary because the configuration properties are
        // determined dynamically at runtime
        // FIXME: this can be eliminated by unifying the forwarder settings types;
        // see `ForwarderConfiguration<...>` for details.
        map((forwarder) => toCredentialGeneratorConfiguration<any>(forwarder)),
        takeUntil(this.destroyed$),
      )
      .subscribe((forwarder) => {
        this.displayDomain = forwarder.request.includes("domain");
        this.displayToken = forwarder.request.includes("token");
        this.displayBaseUrl = forwarder.request.includes("baseUrl");

        forwarder$.next(forwarder);
      });

    const settings$ = forwarder$.pipe(
      map((forwarder) => this.generatorService.settings(forwarder, { account$: this.account$ })),
    );

    // bind settings to the reactive form
    settings$.pipe(switchAll(), takeUntil(this.destroyed$)).subscribe((settings) => {
      // skips reactive event emissions to break a subscription cycle
      this.settings.patchValue(settings as any, { emitEvent: false });
    });

    // enable requested forwarder inputs
    forwarder$.pipe(takeUntil(this.destroyed$)).subscribe((forwarder) => {
      for (const name in Controls) {
        const control = this.settings.get(name);
        if (forwarder.request.includes(name as any)) {
          control.enable({ emitEvent: false });
        } else {
          control.disable({ emitEvent: false });
        }
      }
    });

    // the first emission is the current value; subsequent emissions are updates
    settings$
      .pipe(
        map((settings$) => settings$.pipe(skip(1))),
        switchAll(),
        takeUntil(this.destroyed$),
      )
      .subscribe(this.onUpdated);

    // now that outputs are set up, connect inputs
    this.saveSettings
      .pipe(withLatestFrom(this.settings.valueChanges, settings$), takeUntil(this.destroyed$))
      .subscribe(([, value, settings]) => {
        settings.next(value);
      });
  }

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  async ngOnChanges(changes: SimpleChanges) {
    this.refresh$.complete();
    if ("forwarder" in changes) {
      this.forwarderId$.next(this.forwarder);
    }

    if ("account" in changes) {
      this.account$.next(this.account);
    }
  }

  protected displayDomain: boolean;
  protected displayToken: boolean;
  protected displayBaseUrl: boolean;

  private readonly refresh$ = new Subject<void>();

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
