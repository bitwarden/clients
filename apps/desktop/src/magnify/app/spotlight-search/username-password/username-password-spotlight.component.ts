import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";

import { MagnifySpotlightSearchType } from "../../../constants";
import { SpotlightItemAction, SpotlightSearchComponent } from "../spotlight-search.component";

const MAX_RESULTS = 7;

@Component({
  selector: "app-username-password-spotlight",
  templateUrl: "username-password-spotlight.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SpotlightSearchComponent],
})
export class UsernamePasswordSpotlightComponent implements OnInit {
  readonly type = MagnifySpotlightSearchType.UsernamePassword;

  protected readonly isMac = magnifyIpc.platform === "darwin";
  protected readonly results = signal<MagnifyCipherResult[]>([]);
  protected readonly maxResults = MAX_RESULTS;
  protected readonly copiedPasswordId = signal<string | null>(null);
  protected readonly copiedUsernameId = signal<string | null>(null);

  private readonly COPY_FEEDBACK_MS = 2000;

  ngOnInit() {
    magnifyIpc.onResults((data) => {
      if (data.command === "cipherSearch") {
        const cipherResults = data.results as MagnifyCipherResult[];
        this.results.set(cipherResults.slice(0, MAX_RESULTS));
      }
    });
  }

  protected onQuery(input: string) {
    magnifyIpc.sendCommand({ command: "cipherSearch", input });
  }

  protected onItemAction({ event, item }: SpotlightItemAction) {
    const cipher = item as MagnifyCipherResult;
    const modKey = this.isMac ? event.metaKey : event.ctrlKey;

    if (event.key === "Enter") {
      event.preventDefault();
      this.copyPassword(cipher);
    } else if (event.key === "c" && modKey) {
      event.preventDefault();
      this.copyUsername(cipher);
    } else if (modKey && /^[1-9]$/.test(event.key)) {
      // Shell already updated selectedIndex; execute copy-password for the forwarded item
      this.copyPassword(cipher);
    }
  }

  protected copyPassword(cipher: MagnifyCipherResult) {
    magnifyIpc.sendCommand({ command: "cipherPasswordCopy", input: cipher.id });
    this.copiedPasswordId.set(cipher.id);
    setTimeout(() => this.copiedPasswordId.set(null), this.COPY_FEEDBACK_MS);
  }

  protected copyUsername(cipher: MagnifyCipherResult) {
    magnifyIpc.sendCommand({ command: "cipherUsernameCopy", input: cipher.id });
    this.copiedUsernameId.set(cipher.id);
    setTimeout(() => this.copiedUsernameId.set(null), this.COPY_FEEDBACK_MS);
  }

  protected launchCipher(cipher: MagnifyCipherResult) {
    magnifyIpc.sendCommand({ command: "cipherLaunch", input: cipher.id });
  }
}
