import { Component } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";

@Component({
  selector: "sm-integrations",
  templateUrl: "./integrations.component.html",
  standalone: false,
})
export class IntegrationsComponent {
  private integrationsAndSdks: Integration[] = [];

  constructor() {
    this.integrationsAndSdks = [
      {
        name: "Rust",
        linkURL: "https://github.com/bitwarden/sdk-sm",
        image: "../../../../../../../images/secrets-manager/sdks/rust.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/sdks/rust-white.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "GitHub Actions",
        linkURL: "https://bitwarden.com/help/github-actions-integration/",
        image: "../../../../../../../images/secrets-manager/integrations/github.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/integrations/github-white.svg",
        type: IntegrationType.Integration,
      },
      {
        name: "GitLab CI/CD",
        linkURL: "https://bitwarden.com/help/gitlab-integration/",
        image: "../../../../../../../images/secrets-manager/integrations/gitlab.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/integrations/gitlab-white.svg",
        type: IntegrationType.Integration,
      },
      {
        name: "Ansible",
        linkURL: "https://bitwarden.com/help/ansible-integration/",
        image: "../../../../../../../images/secrets-manager/integrations/ansible.svg",
        type: IntegrationType.Integration,
      },
      {
        name: "C#",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/csharp",
        image: "../../../../../../../images/secrets-manager/sdks/c-sharp.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "C++",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/cpp",
        image: "../../../../../../../images/secrets-manager/sdks/c-plus-plus.png",
        type: IntegrationType.SDK,
      },
      {
        name: "Go",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/go",
        image: "../../../../../../../images/secrets-manager/sdks/go.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Java",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/java",
        image: "../../../../../../../images/secrets-manager/sdks/java.svg",
        imageDarkMode: "../../../../../../../images/secrets-manager/sdks/java-white.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "JS WebAssembly",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/js",
        image: "../../../../../../../images/secrets-manager/sdks/wasm.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "php",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/php",
        image: "../../../../../../../images/secrets-manager/sdks/php.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Python",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/python",
        image: "../../../../../../../images/secrets-manager/sdks/python.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Ruby",
        linkURL: "https://github.com/bitwarden/sdk-sm/tree/main/languages/ruby",
        image: "../../../../../../../images/secrets-manager/sdks/ruby.png",
        type: IntegrationType.SDK,
      },
      {
        name: "Kubernetes Operator",
        linkURL: "https://bitwarden.com/help/secrets-manager-kubernetes-operator/",
        image: "../../../../../../../images/secrets-manager/integrations/kubernetes.svg",
        type: IntegrationType.Integration,
        newBadgeExpiration: "2024-8-12",
      },
    ];
  }

  /** Filter out content for the integrations sections */
  get integrations(): Integration[] {
    return this.integrationsAndSdks.filter(
      (integration) => integration.type === IntegrationType.Integration,
    );
  }

  /** Filter out content for the SDKs section */
  get sdks(): Integration[] {
    return this.integrationsAndSdks.filter(
      (integration) => integration.type === IntegrationType.SDK,
    );
  }
}
