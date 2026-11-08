## Project rules

- Plan, architecture and phase acceptance criteria: `PLAN.md`. Follow it.
- **No personal data in the repo** (names, email, account URLs/handles, repo names, playlist ids). Read them from `astro:env` (schema in `astro.config.mjs`, fake values in `.env.example`). `design/` and `.env` are local-only.
- `src/components/` is presentational only; business logic, data fetching and state live in `src/features/<domain>/`. `components/` never imports from `features/`.
- Pixel perfect against `design/reference.html`: `pnpm test:visual`. Before finishing: `pnpm verify`.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
