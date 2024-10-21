import { Component, EventEmitter, Output } from "@angular/core";
import { BehaviorSubject, map } from "rxjs";

import { GeneratedCredential } from "@bitwarden/generator-core";

@Component({
  selector: "app-ssh-generator",
  templateUrl: "sshkey-generator.component.html",
})
export class SshKeyGeneratorDialogComponent {
  private privateKey = new BehaviorSubject<GeneratedCredential>(null);
  protected canSaveKey$ = this.privateKey.pipe(map((key) => !key));

  @Output() generated = new EventEmitter<GeneratedCredential>();

  onGenerated(privateKey: GeneratedCredential) {
    this.privateKey.next(privateKey);
  }

  onSave() {
    this.generated.emit(this.privateKey.value);
  }

  onCancel() {
    this.generated.emit(null);
  }
}
