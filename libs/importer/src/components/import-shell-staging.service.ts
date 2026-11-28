import { Injectable, OnDestroy } from "@angular/core";

import { DefaultImportStagingService } from "../services";

/** Clears the staged items, and any import returned to the file step, when the providing shell is
 *  destroyed. */
@Injectable()
export class ImportShellStagingService extends DefaultImportStagingService implements OnDestroy {
  ngOnDestroy(): void {
    this.clear();
    this.discardFileStepReturn();
  }
}
