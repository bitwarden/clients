import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

// This icon has static multi-colors for each theme
export function Warning({ theme }: { theme: Theme }) {
  if (theme === ThemeTypes.Dark) {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 40 36">
        <path fill="#FFBF00" d="M15.944 2.483c1.81-3.111 6.303-3.111 8.111 0l15.302 26.319c1.819 3.127-.438 7.049-4.055 7.049H4.698c-3.617 0-5.874-3.922-4.055-7.05L15.944 2.484Z"/>
        <path fill="#0E3781" fill-rule="evenodd" d="M37.735 29.745 22.433 3.425c-1.085-1.866-3.781-1.866-4.866 0L2.265 29.746c-1.091 1.876.263 4.23 2.433 4.23h30.604c2.17 0 3.524-2.354 2.433-4.23ZM24.055 2.483c-1.808-3.111-6.302-3.111-8.11 0L.643 28.802c-1.819 3.127.438 7.049 4.055 7.049h30.604c3.617 0 5.874-3.922 4.055-7.05L24.055 2.484Z" clip-rule="evenodd"/>
        <path fill="#0E3781" d="M21.876 28.345a1.876 1.876 0 1 1-3.752 0 1.876 1.876 0 0 1 3.752 0ZM17.24 11.976a.47.47 0 0 1 .467-.519h4.586c.279 0 .496.242.466.52l-1.307 12.196a.47.47 0 0 1-.466.42h-1.972a.47.47 0 0 1-.466-.42L17.24 11.976Z"/>
      </svg>
    `;
  }

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="36" viewBox="0 0 40 36" fill="none">
      <g clip-path="url(#clip0_2608_9559)">
        <path
          d="M15.9445 2.48268C17.7532 -0.628337 22.2468 -0.628345 24.0555 2.48268L39.3573 28.8018C41.1756 31.9292 38.9194 35.8508 35.3018 35.8508H4.69816C1.08062 35.8508 -1.17559 31.9292 0.642656 28.8018L15.9445 2.48268Z"
          fill="#FFBF00"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M37.7351 29.745L22.4333 3.42582C21.3481 1.55921 18.6519 1.55921 17.5667 3.42582L2.26486 29.745C1.17391 31.6214 2.52764 33.9744 4.69816 33.9744H35.3018C37.4724 33.9744 38.8261 31.6214 37.7351 29.745ZM24.0555 2.48267C22.2468 -0.628345 17.7532 -0.628337 15.9445 2.48268L0.642656 28.8018C-1.17559 31.9292 1.08062 35.8508 4.69816 35.8508H35.3018C38.9194 35.8508 41.1756 31.9292 39.3573 28.8018L24.0555 2.48267Z"
          fill="#0E3781"
        />
        <path
          d="M21.8764 28.345C21.8764 29.3813 21.0363 30.2214 20 30.2214C18.9636 30.2214 18.1235 29.3813 18.1235 28.345C18.1235 27.3086 18.9636 26.4685 20 26.4685C21.0363 26.4685 21.8764 27.3086 21.8764 28.345Z"
          fill="#0E3781"
        />
        <path
          d="M17.2409 11.9761C17.2112 11.6988 17.4285 11.457 17.7074 11.457H22.2926C22.5715 11.457 22.7888 11.6988 22.759 11.9761L21.4522 24.173C21.4267 24.4114 21.2255 24.5922 20.9858 24.5922H19.0142C18.7745 24.5922 18.5733 24.4114 18.5478 24.173L17.2409 11.9761Z"
          fill="#0E3781"
        />
      </g>
      <defs>
        <clipPath id="clip0_2608_9559">
          <rect width="40" height="35.7014" fill="white" transform="translate(0 0.149414)" />
        </clipPath>
      </defs>
    </svg>
  `;
}
