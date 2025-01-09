import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  IconModule,
  svgIcon,
} from "@bitwarden/components";

const announcementIcon = svgIcon`
<svg xmlns="http://www.w3.org/2000/svg" width="86" height="74" fill="none">
  <g fill-rule="evenodd" clip-path="url(#a)" clip-rule="evenodd">
    <path class="tw-fill-art-primary" d="m17.477 51.274 2.472 17.441a3.779 3.779 0 0 0 4.583 3.154l1.497-.342a3.779 3.779 0 0 0 2.759-4.831L23.44 49.91l1.8-.573 5.348 16.784a5.668 5.668 0 0 1-4.138 7.247l-1.497.341a5.668 5.668 0 0 1-6.874-4.73l-2.473-17.44 1.871-.266Z"/>
    <path class="tw-fill-art-accent" d="m55.063 27.1-1.38.316-.211-.92 1.381-.316a3.306 3.306 0 0 1 3.96 2.486l1.052 4.605a3.306 3.306 0 0 1-2.487 3.96l-.92.21-.211-.92.92-.211a2.362 2.362 0 0 0 1.777-2.828l-1.052-4.605a2.362 2.362 0 0 0-2.829-1.777Z"/>
    <path class="tw-fill-art-primary" d="M49.79 12.5a.18.18 0 0 0-.272-.11L21.855 29.438a.181.181 0 0 0-.058.055l-.208.323-10.947 2.5a.457.457 0 0 0-.139.064.664.664 0 0 0-.15.135.343.343 0 0 0-.06.095l.499 2.182-4.36.996c-1.873.428-3.086 2.465-2.64 4.417l1.5 6.566c.446 1.951 2.423 3.26 4.296 2.832l4.36-.996.499 2.182c.012.012.04.034.095.06a.658.658 0 0 0 .194.055c.07.009.122.004.152-.003l10.947-2.501.328.2a.18.18 0 0 0 .075.025l32.324 3.344a.18.18 0 0 0 .196-.218L49.79 12.5Zm-1.263-1.72a2.07 2.07 0 0 1 3.104 1.299L60.6 51.332a2.07 2.07 0 0 1-2.233 2.517l-32.323-3.343a2.072 2.072 0 0 1-.474-.106l-10.26 2.344a2.474 2.474 0 0 1-1.571-.184c-.463-.217-.973-.643-1.127-1.32l-.085-.37-2.518.576c-2.975.68-5.9-1.37-6.559-4.253l-1.5-6.566c-.659-2.883 1.086-6 4.061-6.68l2.518-.575-.084-.37c-.155-.677.12-1.282.442-1.678.325-.4.803-.727 1.334-.848l10.262-2.345c.113-.113.24-.214.38-.3l27.664-17.05Z"/>
    <path class="tw-fill-art-accent" d="m10.792 34.793 3.156 13.814-.92.21L9.87 35.004l.921-.21ZM21.59 29.817l4.246 18.578-.508.12-.512.118L20.68 30.02l.91-.203Z"/>
    <path class="tw-fill-art-primary" d="M64.287.59A.945.945 0 0 1 65.58.248c8.784 5.11 15.628 14.039 18.166 25.145 2.537 11.105.25 22.12-5.443 30.538a.945.945 0 0 1-1.565-1.059c5.398-7.98 7.587-18.46 5.166-29.058C79.48 15.215 72.958 6.726 64.629 1.882A.945.945 0 0 1 64.287.59Z"/>
    <path class="tw-fill-art-accent" d="M61.6 6.385a.472.472 0 0 1 .643-.18c7.245 4.067 12.949 11.44 15.055 20.66s.171 18.338-4.588 25.149a.472.472 0 0 1-.774-.542c4.603-6.587 6.49-15.431 4.441-24.397-2.048-8.965-7.59-16.113-14.596-20.047a.472.472 0 0 1-.18-.643Z"/>
    <path class="tw-fill-art-primary" d="M57.804 11.193a.472.472 0 0 1 .604-.285c6.11 2.186 11.426 8.739 13.364 17.22 1.938 8.48-.006 16.693-4.56 21.315a.472.472 0 1 1-.672-.663c4.27-4.335 6.197-12.187 4.311-20.442-1.886-8.254-7.032-14.49-12.761-16.54a.472.472 0 0 1-.286-.605Z"/>
  </g>
  <defs>
    <clipPath id="a">
      <path fill="#fff" d="M0 0h86v74H0z"/>
    </clipPath>
  </defs>
</svg>
`;

@Component({
  standalone: true,
  selector: "app-vault-ui-onboarding",
  template: `
    <bit-simple-dialog>
      <div bitDialogIcon>
        <bit-icon [icon]="icon"></bit-icon>
      </div>
      <span bitDialogTitle>
        {{ "bitwardenNewLook" | i18n }}
      </span>
      <span bitDialogContent>
        {{ "bitwardenNewLookDesc" | i18n }}
      </span>

      <ng-container bitDialogFooter>
        <button
          bitButton
          type="button"
          buttonType="primary"
          (click)="navigateToLink()"
          bitDialogClose
        >
          {{ "learnMore" | i18n }}
          <i class="bwi bwi-external-link bwi-fw" aria-hidden="true"></i>
        </button>
        <button bitButton type="button" buttonType="secondary" bitDialogClose>
          {{ "close" | i18n }}
        </button>
      </ng-container>
    </bit-simple-dialog>
  `,
  imports: [CommonModule, DialogModule, ButtonModule, JslibModule, IconModule],
})
export class VaultUiOnboardingComponent {
  icon = announcementIcon;

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(VaultUiOnboardingComponent);
  }

  navigateToLink = async () => {
    window.open(
      "https://bitwarden.com/blog/bringing-intuitive-workflows-and-visual-updates-to-the-bitwarden-browser/",
      "_blank",
    );
  };
}
