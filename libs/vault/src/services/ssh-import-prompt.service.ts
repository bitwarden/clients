import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";

export abstract class SshImportPromptService {
  abstract importSshKeyFromClipboard: () => Promise<SshKeyData | null>;
}
