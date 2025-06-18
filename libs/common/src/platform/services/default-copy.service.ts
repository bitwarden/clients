import { CopyService } from "@bitwarden/common/platform/abstractions/copy.service";
import {
  PlatformUtilsService,
  ClipboardOptions,
} from "@bitwarden/common/platform/abstractions/platform-utils.service";

export class DefaultCopyService implements CopyService {
  constructor(private platformUtilsService: PlatformUtilsService) {}

  copyToClipboard(text: string, options?: ClipboardOptions): void | boolean {
    return this.platformUtilsService.copyToClipboard(text, options);
  }
}
