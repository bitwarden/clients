import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { BehaviorSubject, distinctUntilChanged, map, Subject, takeUntil } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import {
  CredentialGeneratorService,
  GeneratedCredential,
  Generators,
} from "@bitwarden/generator-core";

/** Options group for passwords */
@Component({
  selector: "tools-ssh-generator",
  templateUrl: "sshkey-generator.component.html",
})
export class SshKeyGeneratorComponent implements OnInit, OnDestroy {
  constructor(
    private generatorService: CredentialGeneratorService,
    private accountService: AccountService,
    private zone: NgZone,
  ) {}

  /** Binds the passphrase component to a specific user's settings.
   *  When this input is not provided, the form binds to the active
   *  user
   */
  @Input()
  userId: UserId | null;

  /** Emits when the userId changes */
  protected readonly userId$ = new BehaviorSubject<UserId>(null);

  /** Emits credentials created from a generation request. */
  @Output()
  readonly onGenerated = new EventEmitter<GeneratedCredential>();

  async ngOnInit() {
    if (this.userId) {
      this.userId$.next(this.userId);
    } else {
      this.accountService.activeAccount$
        .pipe(
          map((acct) => acct.id),
          distinctUntilChanged(),
          takeUntil(this.destroyed),
        )
        .subscribe(this.userId$);
    }

    const dependencies = {
      userId$: this.userId$,
    };

    this.generatorService
      .generate$(Generators.rsa, dependencies)
      .pipe(takeUntil(this.destroyed))
      .subscribe((generated) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.onGenerated.next(generated);
        });
      });
    this.generatorService
      .generate$(Generators.ed25519, dependencies)
      .pipe(takeUntil(this.destroyed))
      .subscribe((generated) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.onGenerated.next(generated);
        });
      });
  }

  private readonly destroyed = new Subject<void>();
  ngOnDestroy(): void {
    // tear down subscriptions
    this.destroyed.next();
    this.destroyed.complete();

    // finalize component bindings
    this.onGenerated.complete();
  }
}
