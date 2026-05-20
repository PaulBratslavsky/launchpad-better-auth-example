---
name: better-auth-setup
description: >
  Install and configure the three Strapi-community Better Auth plugins
  (plugin-better-auth, plugin-api-permissions, plugin-better-auth-dashboard)
  in a Strapi v5 backend, and wire a Next.js (App Router) frontend to use them.
  Use when the user says "set up better auth", "add better auth to strapi",
  "install plugin-better-auth", "replace users-permissions with better auth",
  "wire better auth into my next.js app", or any variation. Handles the two
  setup gotchas (Strapi 5.45+ required, users-permissions must be removed),
  pins zod 4 to resolve a peer-dep conflict with Strapi's transitive zod 3,
  generates the auth schema, seeds Public-role permissions, and scaffolds the
  Next.js client + sign-up/sign-in forms + user-menu in the navbar.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
metadata:
  author: paul
  version: "1.0.0"
  scope: "Strapi v5 + Next.js App Router only"
---

# Set up Better Auth on Strapi + Next.js

This skill replaces `@strapi/plugin-users-permissions` with the three community Better Auth plugins, and wires a Next.js App Router frontend to use them. Scoped to **Next.js App Router only** in this version — TanStack Start and other frontends are out of scope.

> All three Better Auth plugins are pre-release. The skill is for evaluation / playground use, not production. Warn the user before applying changes if their `package.json` looks like a production project (e.g. has a `"deploy"` script that pushes to a real cloud).

## When to trigger

Match phrases like:
- "set up better auth"
- "add better auth to my strapi project"
- "install plugin-better-auth"
- "replace users-permissions with better auth"
- "wire up better auth in next.js"

Do **not** trigger when:
- The user only wants to consult the docs without changing files
- The user is on a non-App-Router Next.js setup (Pages Router) — surface as a known limitation and ask if they want to proceed anyway
- The user is on TanStack Start, Vite, Astro, etc. — tell them this skill is Next.js only and stop

## Architecture this skill produces

Three Strapi plugins do the work `users-permissions` used to do:

- `@strapi-community/plugin-better-auth` — auth flows (sign-up, sign-in, sessions)
- `@strapi-community/plugin-api-permissions` — Content API RBAC (Public + Authenticated roles)
- `@strapi-community/plugin-better-auth-dashboard` — admin UI for managing users/sessions

Plus on the frontend:
- `better-auth/react` client
- A sign-up page (or updated form), a sign-in page, a `UserMenu` component in the navbar

## Pre-flight checks (do these before touching files)

1. **Find the Strapi project root.** Look for `package.json` containing `@strapi/strapi` in `dependencies`. If the working directory is a monorepo (e.g. LaunchPad-shaped: `strapi/` + `next/` folders), descend into the Strapi folder.
2. **Find the Next.js project root.** Look for `package.json` containing `next` in `dependencies`. May or may not be a sibling of the Strapi folder.
3. **Confirm Strapi 5.45.0+.** Read `@strapi/strapi` version from `package.json`. If less than `5.45.0`, the plugin will throw at boot. Ask the user to confirm bumping to `5.46.0` before proceeding.
4. **Detect users-permissions.** If `@strapi/plugin-users-permissions` is in Strapi `package.json` dependencies, the new plugin will refuse to load. Warn the user explicitly: this skill will remove that package. Ask for confirmation before continuing — losing users-permissions also means losing any existing user accounts stored in its table.
5. **Detect router type for Next.js.** Check for `next/app/` (App Router) vs `next/pages/` (Pages Router). Refuse Pages Router unless the user explicitly opts in.
6. **Detect package manager.** `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, `package-lock.json` → npm. Use it consistently throughout.

Surface the findings to the user with `AskUserQuestion` before applying any changes:
- "Strapi at `<path>` is version `<x.y.z>`. Frontend at `<path>` uses Next.js App Router. users-permissions: <present|absent>. Proceed?"

## What the skill does (in order)

The order matters — Step 5 (bootstrap) depends on Step 6 (schema generation) having been deferred. Don't reorder.

### 1. Bump Strapi to 5.46.0 (if needed)

If Strapi is below `5.45.0`, edit `package.json` to pin `@strapi/strapi`, `@strapi/plugin-cloud`, `@strapi/plugin-users-permissions` to `5.46.0`. (We'll remove users-permissions next, but we still want it to install during the intermediate state.)

### 2. Remove `@strapi/plugin-users-permissions`

Drop it from `dependencies` in the Strapi `package.json`. Do NOT leave it there and try to disable it in `config/plugins.ts` — the better-auth plugin checks for package presence, not enabled state.

### 3. Install the community plugins

Use the project's package manager. With yarn:

```bash
yarn add \
  better-auth \
  @strapi-community/plugin-better-auth@^1.0.0-beta.1 \
  @strapi-community/plugin-api-permissions@^1.0.0-alpha.3 \
  @strapi-community/plugin-better-auth-dashboard@^1.0.0-alpha.1 \
  @better-auth/infra \
  zod@^4.1.12
```

With npm: `npm install --legacy-peer-deps <same packages>`. With pnpm: `pnpm add <same packages>`.

Run from the Strapi directory.

The only workaround in this list is **`zod@^4.1.12`**. `@better-auth/infra` peer-depends on zod 4 and calls `z.email()` (a zod 4 API). Strapi's transitive deps pull in zod 3, which wins the top-level `node_modules` slot by default and breaks `@better-auth/infra`. Pinning zod 4 in the project's `package.json` forces it to the top. This applies to all three package managers.

### 4. Write Strapi config files

Use the templates in `templates/`:

- `templates/strapi-config-plugins.ts` → write to `<strapi>/config/plugins.ts`
- `templates/strapi-src-lib-auth.ts` → write to `<strapi>/src/lib/auth.ts` (create directories if needed)
- `templates/strapi-src-index.ts` → write to `<strapi>/src/index.ts` (overwrite the boilerplate)

If `<strapi>/.env` doesn't exist, copy `<strapi>/.env.example` to `<strapi>/.env`, then append:

```
BETTER_AUTH_SECRET=<generate-via-openssl-rand-base64-32>
BETTER_AUTH_DASHBOARD_SECRET=<generate-via-openssl-rand-base64-32>
```

For local-only setups you can use static placeholders. For anything else, generate real secrets and tell the user to rotate them before deploying.

### 5. Generate the Better Auth schema

```bash
npx -y @better-auth/cli generate --config src/lib/auth.ts --yes
```

`npx` works in yarn, npm, and pnpm projects equally well — it runs the binary out of the project's node_modules if installed, otherwise downloads it. No need to add `@better-auth/cli` as a dev dep.

Verify that `<strapi>/src/extensions/better-auth/content-types/` now contains `user/`, `session/`, `account/`, `verification/`, and `jwks/` subdirectories with `schema.json` inside each. If `jwks/` is missing, the `jwt()` plugin didn't load — re-check `src/lib/auth.ts`.

### 6. Boot Strapi once to seed roles and permissions

The skill's bootstrap (from `templates/strapi-src-index.ts`) seeds Public-role `find`/`findOne` permissions for every `api::*.*` content type on first boot. To trigger it, start the dev server briefly and stop once it logs `Strapi started successfully`:

```bash
# from Strapi dir
yarn develop > /tmp/strapi-bootstrap.log 2>&1 &
echo $! > /tmp/strapi-bootstrap.pid
# poll for ready, then kill
```

After this, `curl http://localhost:1337/api/global` (or any seeded endpoint) should return 200, not 401.

### 7. Wire up the Next.js frontend

Frontend file edits:

- Install `better-auth`: `yarn add better-auth` in the Next.js dir
- If `<next>/.env` doesn't exist, copy `.env.example` to `.env` — confirm `NEXT_PUBLIC_API_URL=http://localhost:1337` (or whatever the Strapi URL is) is set. Without this the Strapi client fails to initialize.
- `templates/next-lib-auth-client.ts` → `<next>/lib/auth-client.ts`
- `templates/next-components-register.tsx` → `<next>/components/register.tsx` (overwrites if exists)
- `templates/next-components-sign-in-form.tsx` → `<next>/components/sign-in-form.tsx` (new)
- `templates/next-app-sign-in-page.tsx` → `<next>/app/[locale]/sign-in/page.tsx` (new — adjust path if the user doesn't use the `[locale]` segment)
- `templates/next-components-navbar-user-menu.tsx` → `<next>/components/navbar/user-menu.tsx` (new)
- For the existing `<next>/components/navbar/desktop-navbar.tsx` and `mobile-navbar.tsx`, **edit in place** rather than overwriting — add the import for `UserMenu` and a render slot. Read the existing files, find a sensible spot (usually near the existing action buttons), and use Edit to insert. Do not blindly overwrite — these files are project-specific.

Do not assume the locale segment exists. If `<next>/app/[locale]/` is missing, look for `<next>/app/sign-up/` or similar conventions and adapt the path.

### 8. Verify end-to-end

Boot both servers and confirm sign-up works. If Playwright is available in the user's environment, drive the form. Otherwise use curl:

```bash
curl -X POST http://localhost:1337/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"test@example.com","password":"testpass1234","name":"Test"}'
```

Expect HTTP 200 with `{token, user: {id, name, email, ...}}`. If you get 500, check `src/lib/auth.ts` syntax. If you get 404, the plugin isn't loading — check `config/plugins.ts`.

## Failure modes and how to handle them

| Failure | Likely cause | Fix |
| --- | --- | --- |
| `Error: The 'users-permissions' plugin is installed.` at Strapi boot | Step 2 was skipped | Remove `@strapi/plugin-users-permissions` from `package.json`, reinstall |
| `Strapi v5.4x.x is not supported. Please upgrade to v5.45.0 or higher.` | Step 1 was skipped | Bump Strapi packages |
| `TypeError: z.email is not a function` during schema gen | zod 3 won the top-level hoist | Confirm `zod@^4.1.12` is in `package.json` and reinstall |
| `TypeError: Cannot read properties of undefined (reading 'attributes')` from `addUserCount` during schema gen | The bootstrap from Step 4 ran before schema existed | The template's defensive guard handles this. If you wrote a custom bootstrap, add `if (!strapi.contentTypes['plugin::better-auth.user']) return;` at the top |
| `Could not initialize the Strapi Client … Could not parse invalid URL: "/api"` on Next.js boot | Missing `next/.env` with `NEXT_PUBLIC_API_URL` | Copy `.env.example` to `.env` |
| `401 Unauthorized` on every `/api/*` content endpoint | Step 6 was skipped or the bootstrap silently bailed | Check Strapi logs for the warning `Public role not found`. Boot Strapi once after schema gen exists |
| Sign-up returns 200 but navbar doesn't show user | Probably hitting `router.push('/')` and the i18n proxy throws under headless | Use `` router.push(`/${locale}`) `` in the form — the templates already do this |

## After the skill runs

Tell the user:

- Strapi admin: `http://localhost:1337/admin` — look for the **Better Auth** tab in the left nav
- API permissions UI: **Settings → API Permissions → Roles** in the admin
- Sign-up: `http://localhost:3000/<locale>/sign-up` (or `/sign-up` if no locale)
- Endpoint base path: `/api/auth/*` (not `/api/better-auth/*` — that was the alpha path)
- Both secrets in `.env` are placeholders — rotate before deploying anywhere

Point them at `references/` for the full reference docs:
- `references/architecture.md` — how the three plugins fit together
- `references/extending.md` — adding social providers, 2FA, magic links

## Out of scope for v1.0

- **TanStack Start** — separate skill should be created when needed; same backend setup, different frontend wiring
- **Pages Router Next.js** — not tested
- **Migrating existing users-permissions data** — manual SQL migration, not automated here
- **Production secret generation** — skill uses placeholders for local dev; users handle prod secrets themselves
- **Social providers** — env vars and config blocks not added by default; user follows up via `references/extending.md`
