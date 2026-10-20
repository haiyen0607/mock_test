/** Shared layout styles for the login and register pages. */
export const AUTH_STYLES = `
  .auth-wrap {
    min-height: calc(100dvh - 6rem);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem 0;
  }
  .auth-grid {
    width: 100%; max-width: 1040px;
    display: grid; grid-template-columns: 1fr; gap: 1.5rem;
    align-items: stretch;
  }
  @media (min-width: 992px) {
    .auth-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  }
  .auth-form {
    width: 100%; max-width: 460px; margin-inline: auto;
    padding: 2rem 1.5rem;
    box-shadow: var(--shadow-md);
  }
  @media (min-width: 576px) { .auth-form { padding: 2.5rem 2.25rem; } }
  @media (min-width: 992px) { .auth-form { max-width: none; } }

  .brand-mark {
    display: inline-flex; align-items: center; gap: 0.55rem;
    font-family: var(--font-display); font-weight: 800; font-size: 1.1rem;
    color: var(--text); text-decoration: none; margin-bottom: 1.75rem;
  }
  .brand-mark:hover { color: var(--text); }
  /* Same "Q" mark as the app shell (.brand-mark in app.component.ts) */
  .brand-glyph {
    width: 36px; height: 36px; border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--brand-500); color: var(--brand-contrast);
    font-family: var(--font-display); font-weight: 800; font-size: 1.15rem;
    transform: rotate(-6deg);
    box-shadow: 0 3px 0 rgba(var(--brand-rgb), 0.25);
  }
  .auth-title { font-size: clamp(1.6rem, 1.3rem + 1vw, 2rem); margin: 0 0 0.35rem; }
  .auth-sub { color: var(--text-2); margin: 0 0 1.75rem; }
  .auth-switch { text-align: center; color: var(--text-2); margin: 1.5rem 0 0; }
  .auth-switch a { font-weight: 700; text-decoration: none; margin-left: 0.25rem; }
  .auth-switch a:hover { text-decoration: underline; }

  /* Password field with show/hide toggle inside the input */
  .pw-field { position: relative; }
  .pw-field > .form-control { padding-right: 3rem; }
  .pw-toggle {
    position: absolute; right: 0.3rem; top: 50%; transform: translateY(-50%);
    width: 2.1rem; height: 2.1rem;
    background: transparent; border: 0; color: var(--text-2);
  }
  .pw-toggle:hover, .pw-toggle[aria-pressed="true"] { color: var(--text); background: var(--surface-2); }
  .pw-toggle:focus-visible { box-shadow: var(--ring); outline: none; }

  .auth-brand { display: none; }
  @media (min-width: 992px) {
    .auth-brand {
      display: flex; flex-direction: column; justify-content: center;
      padding: 2.5rem;
      background: var(--brand-soft);
      border-radius: var(--radius-card);
      overflow: hidden;
    }
  }
  .art { position: relative; width: 220px; height: 170px; margin-bottom: 2rem; }
  .shape { position: absolute; display: block; }
  .blob {
    inset: 10px 30px 0 0;
    background: var(--brand-200);
    border-radius: 46% 54% 42% 58% / 55% 45% 55% 45%;
  }
  .ring {
    width: 56px; height: 56px; right: 0; top: -6px;
    border: 4px solid var(--brand-300); border-radius: 50%;
  }
  .square {
    width: 34px; height: 34px; left: -8px; bottom: 6px;
    background: var(--brand-500); border-radius: 10px; transform: rotate(14deg);
  }
  .dot {
    width: 12px; height: 12px; right: 40px; bottom: -4px;
    background: var(--brand-600); border-radius: 50%;
  }
  .glyph {
    position: absolute; left: 44%; top: 50%;
    transform: translate(-50%, -50%) rotate(-6deg);
    width: 84px; height: 84px; border-radius: 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); color: var(--brand-500);
    box-shadow: var(--shadow-md); font-size: 2.3rem;
  }
  .brand-heading { font-size: 1.6rem; color: var(--brand-soft-text); margin: 0 0 1.25rem; max-width: 18ch; }
  .benefits { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.85rem; }
  .benefits li { display: flex; align-items: center; gap: 0.85rem; color: var(--text); font-weight: 600; }
  .benefits .icon-tile { background: var(--surface); width: 2.4rem; height: 2.4rem; font-size: 1.05rem; border-radius: 12px; }
`;
