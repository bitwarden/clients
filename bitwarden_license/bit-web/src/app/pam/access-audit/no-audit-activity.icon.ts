import { svg } from "@bitwarden/assets/svg";

/**
 * Log-page-with-clock glyph shown on the PAM audit empty state. Shares the rounded-tile frame with
 * {@link NoAccessRulesIcon} so the two PAM empty states read as one family, and maps its fills to
 * the `primary` theme tokens so the illustration adapts to light/dark themes.
 */
export const NoAuditActivityIcon = svg`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64">
  <path class="tw-fill-primary-100" d="M12 .5h40C58.351.5 63.5 5.649 63.5 12v40c0 6.351-5.149 11.5-11.5 11.5H12C5.649 63.5.5 58.351.5 52V12C.5 5.649 5.649.5 12 .5"/>
  <path class="tw-stroke-primary-300" d="M12 .5h40C58.351.5 63.5 5.649 63.5 12v40c0 6.351-5.149 11.5-11.5 11.5H12C5.649 63.5.5 58.351.5 52V12C.5 5.649 5.649.5 12 .5Z"/>
  <rect class="tw-stroke-primary-600" x="17.5" y="14.5" width="25" height="35" rx="3.5" stroke-width="3"/>
  <rect class="tw-fill-primary-600" x="22" y="21" width="4" height="4" rx="2"/>
  <rect class="tw-fill-primary-600" x="29" y="21.5" width="10" height="3" rx="1.5"/>
  <rect class="tw-fill-primary-600" x="22" y="30" width="4" height="4" rx="2"/>
  <rect class="tw-fill-primary-600" x="29" y="30.5" width="10" height="3" rx="1.5"/>
  <rect class="tw-fill-primary-600" x="22" y="39" width="4" height="4" rx="2"/>
  <rect class="tw-fill-primary-600" x="29" y="39.5" width="10" height="3" rx="1.5"/>
  <circle class="tw-fill-primary-100" cx="44" cy="44" r="11"/>
  <circle class="tw-stroke-primary-600" cx="44" cy="44" r="9.5" stroke-width="3"/>
  <path class="tw-stroke-primary-600" d="M44 39v5l3.5 2.5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
