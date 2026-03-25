import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  FormFieldModule,
  SectionComponent,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  selector: "app-receive-upload",
  templateUrl: "receive-file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CommonModule,
    FormFieldModule,
    JslibModule,
    SectionComponent,
    TypographyModule,
  ],
})
export class ReceiveFileUploadComponent implements OnInit {
  readonly files: Array<File> = [];
  readonly fileName = signal<string>("");
  readonly receiveId = signal<string>("");
  readonly secretB64 = signal<string>("");
  readonly sharedContentEncryptionKeyB64 = signal<string>("");
  readonly showUploadFilesButton = signal<boolean>(false);

  constructor(route: ActivatedRoute) {
    const params = route.snapshot.paramMap;
    this.receiveId.set(params.get("receiveId") || "");
    this.secretB64.set(params.get("secretB64") || "");
    this.sharedContentEncryptionKeyB64.set(params.get("sharedContentEncryptionKeyB64") || "");
  }

  ngOnInit() {
    void this.loadContent();
  }

  loadContent() {
    // 1. Call api server with receive id and secret
    // 2. Update content on page (e.g. receive name + email of owner)
  }

  addFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.files.push(file);
    this.fileName.set(file.name);
    this.showUploadFilesButton.set(true);
  }

  removeFiles() {
    this.files.length = 0;
    this.fileName.set("");
    this.showUploadFilesButton.set(false);
  }

  uploadFiles() {
    if (this.files.length == 0) {
      return;
    }
    this.files.forEach((file, idx) => {
      // 1. Encrypt file
      // 2. Call api server with enough info to obtain upload URL
      // 3. Upload file
    });
  }
}
