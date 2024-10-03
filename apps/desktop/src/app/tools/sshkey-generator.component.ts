import { Component, EventEmitter, Output } from "@angular/core";

@Component({
  selector: "app-ssh-generator",
  templateUrl: "sshkey-generator.component.html",
})
export class SshKeyGeneratorDialogComponent {
  privateKey: string;
  @Output() generated = new EventEmitter<string>();

  onGenerated(privateKey: string) {
    this.privateKey = privateKey;
  }

  onSave() {
    this.generated.emit(this.privateKey);
  }

  onCancel() {
    this.generated.emit(null);
  }
}
