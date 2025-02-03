import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

// This icon has static multi-colors for each theme
export function PartyHorn({ theme }: { theme: Theme }) {
  if (theme === ThemeTypes.Dark) {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="none">
        <path
          fill="#030C1B"
          d="M33.044 37.587 5.716 48.972a2.275 2.275 0 0 1-2.975-2.975L14.127 18.67a4.31 4.31 0 0 1 5.217-2.47l.77.23a22.625 22.625 0 0 1 15.17 15.17l.23.77a4.31 4.31 0 0 1-2.47 5.217Z"
        />
        <path
          fill="#FFBF00"
          fill-rule="evenodd"
          d="M15.947 44.71a47.282 47.282 0 0 1-4.768-4.175 47.292 47.292 0 0 1-4.175-4.768l.48-1.154a45.963 45.963 0 0 0 4.457 5.16 45.967 45.967 0 0 0 5.16 4.456l-1.154.481ZM11.4 46.604a56.295 56.295 0 0 1-6.292-6.291l-.463 1.112a57.493 57.493 0 0 0 5.642 5.643l1.113-.464Zm10.65-4.437c-2.38-1.42-4.765-3.271-7-5.505-2.233-2.234-4.084-4.62-5.504-6.999l.52-1.25c1.414 2.52 3.347 5.087 5.747 7.487 2.4 2.4 4.966 4.332 7.486 5.746l-1.25.52Zm-9.634-19.393c.894 3.259 3.09 6.93 6.342 10.181 3.251 3.252 6.922 5.448 10.18 6.341l1.747-.727a12.588 12.588 0 0 1-1.756-.396c-2.975-.885-6.364-2.934-9.41-5.98-3.045-3.045-5.094-6.434-5.98-9.41a12.584 12.584 0 0 1-.395-1.755l-.728 1.746Z"
          clip-rule="evenodd"
        />
        <path
          fill="#0E3377"
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
          d="M27.985 23.73c2.174 2.174 3.79 4.462 4.653 6.387.432.965.663 1.811.699 2.491.035.68-.125 1.13-.4 1.406-.276.275-.726.436-1.406.4-.68-.035-1.526-.267-2.49-.699-1.926-.863-4.214-2.478-6.389-4.653-2.175-2.175-3.79-4.463-4.653-6.388-.432-.965-.664-1.811-.7-2.49-.035-.68.126-1.131.401-1.407.275-.275.726-.436 1.406-.4.68.036 1.526.267 2.49.7 1.926.862 4.214 2.478 6.389 4.652Z"
        />
        <path
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
          d="M33.044 37.587 5.716 48.972a2.275 2.275 0 0 1-2.975-2.975L14.127 18.67a4.31 4.31 0 0 1 5.217-2.47l.77.23a22.625 22.625 0 0 1 15.17 15.17l.23.77a4.31 4.31 0 0 1-2.47 5.217Z"
        />
        <path
          fill="#91B4F2"
          d="M25.46 2.47a.407.407 0 0 1 .793 0l.02.086a3.232 3.232 0 0 0 2.415 2.414l.086.02a.407.407 0 0 1 0 .793l-.086.02a3.232 3.232 0 0 0-2.414 2.415l-.02.086a.407.407 0 0 1-.794 0l-.02-.086a3.232 3.232 0 0 0-2.414-2.414l-.087-.02a.407.407 0 0 1 0-.794l.087-.02a3.232 3.232 0 0 0 2.414-2.414l.02-.086ZM45.93 10.55a.407.407 0 0 1 .794 0l.02.086a3.232 3.232 0 0 0 2.414 2.415l.086.02a.407.407 0 0 1 0 .793l-.086.02a3.232 3.232 0 0 0-2.414 2.414l-.02.087a.407.407 0 0 1-.794 0l-.02-.087a3.232 3.232 0 0 0-2.414-2.414l-.086-.02a.407.407 0 0 1 0-.793l.086-.02a3.232 3.232 0 0 0 2.414-2.415l.02-.086ZM38.928 43.41a.407.407 0 0 1 .793 0l.02.086a3.232 3.232 0 0 0 2.414 2.414l.086.02a.407.407 0 0 1 0 .794l-.086.02a3.232 3.232 0 0 0-2.414 2.414l-.02.086a.407.407 0 0 1-.793 0l-.02-.086a3.232 3.232 0 0 0-2.415-2.414l-.086-.02a.407.407 0 0 1 0-.793l.086-.02a3.232 3.232 0 0 0 2.414-2.415l.02-.086Z"
        />
        <path
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
          d="M37.708 27.827a4.31 4.31 0 0 1 6.095 0M36.63 24.873a6.95 6.95 0 0 1 9.495-2.544M17.238 13.467a4.31 4.31 0 0 0-4.31-4.31M18.583 10.392a4.31 4.31 0 0 0-2.533-5.544"
        />
        <circle
          cx="32.86"
          cy="11.313"
          r="1.616"
          fill="#0E3377"
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
        />
        <circle
          cx="36.631"
          cy="17.777"
          r="1.077"
          fill="#030C1B"
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
        />
        <circle
          cx="30.705"
          cy="44.172"
          r="1.077"
          fill="#030C1B"
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
        />
        <circle
          cx="44.711"
          cy="34.476"
          r="2.155"
          fill="#FFBF00"
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
        />
        <circle
          cx="41.479"
          cy="5.926"
          r="3.232"
          fill="#202733"
          stroke="#91B4F2"
          stroke-linecap="round"
          stroke-width="1.077"
        />
      </svg>
    `;
  }

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="none">
      <path
        fill="#DFE9FB"
        d="M33.044 37.587 5.716 48.972a2.275 2.275 0 0 1-2.975-2.975L14.127 18.67a4.31 4.31 0 0 1 5.217-2.47l.77.23a22.625 22.625 0 0 1 15.17 15.17l.23.77a4.31 4.31 0 0 1-2.47 5.217Z"
      />
      <path
        fill="#FFBF00"
        fill-rule="evenodd"
        d="M15.947 44.71a47.27 47.27 0 0 1-4.768-4.175 47.284 47.284 0 0 1-4.175-4.768l.48-1.154a45.953 45.953 0 0 0 4.457 5.16 45.958 45.958 0 0 0 5.16 4.456l-1.154.481ZM11.4 46.604a56.295 56.295 0 0 1-6.292-6.291l-.463 1.112a57.493 57.493 0 0 0 5.642 5.643l1.113-.464Zm10.65-4.437c-2.38-1.42-4.765-3.271-7-5.505-2.233-2.234-4.084-4.62-5.504-6.999l.52-1.25c1.414 2.52 3.347 5.087 5.747 7.487 2.4 2.4 4.966 4.332 7.486 5.746l-1.25.52Zm-9.634-19.393c.894 3.259 3.09 6.93 6.342 10.181 3.251 3.252 6.922 5.448 10.18 6.341l1.747-.727a12.586 12.586 0 0 1-1.756-.396c-2.975-.885-6.364-2.934-9.41-5.98-3.045-3.045-5.094-6.434-5.98-9.41a12.585 12.585 0 0 1-.395-1.755l-.728 1.746Z"
        clip-rule="evenodd"
      />
      <path
        fill="#99BAF4"
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
        d="M27.985 23.73c2.175 2.174 3.79 4.462 4.653 6.387.432.965.663 1.811.699 2.491.036.68-.125 1.13-.4 1.406-.276.275-.726.436-1.406.4-.68-.035-1.526-.267-2.49-.699-1.926-.863-4.214-2.478-6.389-4.653-2.175-2.175-3.79-4.463-4.653-6.388-.432-.965-.664-1.811-.7-2.49-.035-.68.126-1.131.401-1.407.275-.275.726-.436 1.406-.4.68.036 1.526.267 2.49.7 1.926.862 4.214 2.478 6.389 4.652Z"
      />
      <path
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
        d="M33.044 37.587 5.716 48.972a2.275 2.275 0 0 1-2.975-2.975L14.127 18.67a4.31 4.31 0 0 1 5.217-2.47l.77.23a22.625 22.625 0 0 1 15.17 15.17l.23.77a4.31 4.31 0 0 1-2.47 5.217Z"
      />
      <path
        fill="#0E3781"
        d="M25.46 2.47a.407.407 0 0 1 .793 0l.02.086a3.232 3.232 0 0 0 2.415 2.414l.086.02a.407.407 0 0 1 0 .793l-.086.02a3.232 3.232 0 0 0-2.414 2.415l-.02.086a.407.407 0 0 1-.794 0l-.02-.086a3.232 3.232 0 0 0-2.414-2.414l-.086-.02a.407.407 0 0 1 0-.794l.086-.02a3.232 3.232 0 0 0 2.414-2.414l.02-.086ZM45.93 10.55a.407.407 0 0 1 .794 0l.02.086a3.232 3.232 0 0 0 2.414 2.415l.086.02a.407.407 0 0 1 0 .793l-.086.02a3.232 3.232 0 0 0-2.414 2.414l-.02.087a.407.407 0 0 1-.794 0l-.02-.087a3.232 3.232 0 0 0-2.414-2.414l-.086-.02a.407.407 0 0 1 0-.793l.086-.02a3.232 3.232 0 0 0 2.414-2.415l.02-.086ZM38.928 43.41a.407.407 0 0 1 .793 0l.02.086a3.232 3.232 0 0 0 2.414 2.414l.086.02a.407.407 0 0 1 0 .794l-.086.02a3.232 3.232 0 0 0-2.414 2.414l-.02.086a.407.407 0 0 1-.793 0l-.02-.086a3.232 3.232 0 0 0-2.415-2.414l-.086-.02a.407.407 0 0 1 0-.793l.086-.02a3.232 3.232 0 0 0 2.414-2.415l.02-.086Z"
      />
      <path
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
        d="M37.708 27.827a4.31 4.31 0 0 1 6.095 0M36.63 24.873a6.95 6.95 0 0 1 9.495-2.544M17.238 13.467a4.31 4.31 0 0 0-4.31-4.31M18.583 10.392a4.31 4.31 0 0 0-2.533-5.544"
      />
      <circle
        cx="32.86"
        cy="11.313"
        r="1.616"
        fill="#99BAF4"
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
      />
      <circle
        cx="36.631"
        cy="17.777"
        r="1.077"
        fill="#DFE9FB"
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
      />
      <circle
        cx="30.705"
        cy="44.172"
        r="1.077"
        fill="#DFE9FB"
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
      />
      <circle
        cx="44.711"
        cy="34.476"
        r="2.155"
        fill="#FFBF00"
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
      />
      <circle
        cx="41.479"
        cy="5.926"
        r="3.232"
        fill="#fff"
        stroke="#0E3781"
        stroke-linecap="round"
        stroke-width="1.077"
      />
    </svg>
  `;
}
