import { Component } from "@angular/core";

import { LockComponent as BaseLockComponent } from "@bitwarden/angular/auth/components/lock.component";

@Component({
  selector: "app-lock",
  templateUrl: "lock.component.html",
})
export class LockComponent extends BaseLockComponent {
  async ngOnInit() {
    await super.ngOnInit();
    this.onSuccessfulSubmit = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigateByUrl(this.successRoute);
    };
  }
}
