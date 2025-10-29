// this svg includes the Duo logo, which contains colors not part of our bitwarden theme colors
/* eslint-disable @bitwarden/components/require-theme-colors-in-svg */
import { svgIcon } from "../icon-service";

export const TwoFactorAuthDuoIcon = svgIcon`
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 120 40">
    <g clip-path="url(#two-factor-auth-duo-clip)">
        <path fill="#7BCD54" d="M19.359 39.412H0V20.97h38.694c-.505 10.27-8.968 18.44-19.335 18.44Z" />
        <path fill="#63C43F"
            d="M19.359.588H0V19.03h38.694C38.188 8.76 29.726.59 19.358.59ZM100.666.588c-10.367 0-18.83 8.172-19.335 18.441H120C119.496 8.76 111.033.59 100.666.59Z" />
        <path fill="#7BCD54"
            d="M100.666 39.412c-10.367 0-18.83-8.171-19.335-18.441H120c-.504 10.27-8.967 18.44-19.334 18.44Z" />
        <path fill="#63C43F" d="M40.653.588V20c0 10.395 8.15 18.882 18.391 19.388V.588h-18.39Z" />
        <path fill="#7BCD54" d="M79.37 39.412H60.98V.588h18.39v38.824Z" />
    </g>
    <defs>
        <clipPath id="two-factor-auth-duo-clip">
            <path class="tw-fill-text-alt2" d="M0 .588h120v38.824H0z" />
        </clipPath>
    </defs>
</svg>
`;
