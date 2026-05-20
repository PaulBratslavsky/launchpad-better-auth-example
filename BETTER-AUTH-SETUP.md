# Setting up Better Auth with Strapi v5 and Next.js

This guide walks through installing and configuring the three Strapi-community plugins that together replace `@strapi/plugin-users-permissions` with a modern, modular auth stack:

| Plugin | What it does |
| --- | --- |
| [`@strapi-community/plugin-better-auth`](https://github.com/strapi-community/plugin-better-auth/tree/main/plugins/plugin-better-auth) | Database adapter that wires [Better Auth](https://better-auth.com) into Strapi. Owns sign-up, sign-in, sessions, social providers. |
| [`@strapi-community/plugin-api-permissions`](https://github.com/strapi-community/plugin-better-auth/tree/main/plugins/plugin-api-permissions) | Auth-agnostic Content API RBAC. Seeds **Public** and **Authenticated** roles, exposes a Strapi admin UI for per-content-type permissions. Replaces the role/permission system users-permissions used to provide. |
| [`@strapi-community/plugin-better-auth-dashboard`](https://github.com/strapi-community/plugin-better-auth/tree/main/plugins/plugin-better-auth-dashboard) | Admin panel dashboard for Better Auth: user list, session management, DAU/WAU/MAU rings, growth charts. |

All three are in pre-release (better-auth in beta, the other two in alpha at time of writing). Do not use in production yet.

---

## Prerequisites

- Node.js **20+**
- Strapi **5.45.0+** (the better-auth plugin enforces this in its `register` lifecycle)
- A new or existing Strapi v5 project
- A Next.js (or other) frontend project

---

## Step 1 — Remove `@strapi/plugin-users-permissions`

`plugin-better-auth` **refuses to load** if `users-permissions` is installed. It is not enough to disable it in `config/plugins.ts`; the package must be removed from `dependencies`.

The check lives in `plugin-better-auth/server/src/register.ts` and reads:

```ts
if (usersPermissionsPlugin) {
  throw new Error(
    "[@strapi-community/plugin-better-auth] The 'users-permissions' plugin is installed. " +
      "Better Auth and users-permissions cannot be used together.",
  );
}
```

Remove it:

```bash
# from your Strapi project root
yarn remove @strapi/plugin-users-permissions
```

> **Heads-up:** removing U&P also removes the Public role it used to seed. Until you set up `plugin-api-permissions` (Step 3) and seed Public permissions (Step 5), every `/api/*` content endpoint will return **401**.

---

## Step 2 — Install the plugins (Strapi side)

From your Strapi project root:

```bash
yarn add \
  better-auth \
  @strapi-community/plugin-better-auth \
  @strapi-community/plugin-api-permissions \
  @strapi-community/plugin-better-auth-dashboard \
  @better-auth/infra \
  @better-auth/core \
  zod@^4.1.12

yarn add -D @better-auth/cli
```

Why the extras matter:

- **`@better-auth/core`** — `@better-auth/infra` (which the dashboard's `dash()` plugin uses) imports it directly. Yarn nests it inside `better-auth/node_modules/` by default, so node-modules linker resolution from `infra` fails with `Cannot find package '@better-auth/core'`. Adding it as a top-level dep forces hoisting.
- **`zod@^4.1.12`** — `@better-auth/infra` calls `z.email()`, which only exists in zod **4.x**. Strapi pulls in zod 3.x transitively. Pinning zod 4 at the top of your project's tree puts the correct version in scope.
- **`@better-auth/cli`** as a dev dep — `yarn dlx @better-auth/cli` runs in an isolated env that cannot see your project's hoisted `@better-auth/core`. Installing the CLI locally and invoking it with `yarn exec better-auth ...` fixes that.

Your `package.json` `dependencies` should look roughly like this:

```jsonc
{
  "dependencies": {
    "@better-auth/core": "^1.4.x",
    "@better-auth/infra": "^0.2.x",
    "@strapi-community/plugin-api-permissions": "^1.0.0-alpha.3",
    "@strapi-community/plugin-better-auth": "^1.0.0-beta.1",
    "@strapi-community/plugin-better-auth-dashboard": "^1.0.0-alpha.7",
    "@strapi/plugin-cloud": "5.46.0",
    "@strapi/strapi": "5.46.0",
    "better-auth": "^1.4.10",
    "zod": "^4.1.12"
    // ...
  },
  "devDependencies": {
    "@better-auth/cli": "latest"
  }
}
```

> Note: `^1.0.0-beta.1` resolves to the latest 1.0.0-beta.* (e.g. `1.0.0-beta.6`) due to npm semver caret semantics with prerelease tags. Pin without the caret if you need an exact version.

---

## Step 3 — Enable plugins in `config/plugins.ts`

```ts
// strapi/config/plugins.ts
export default () => ({
  'better-auth': {
    enabled: true,
  },
  'better-auth-dashboard': {
    enabled: true,
  },
  'api-permissions': {
    enabled: true,
  },
});
```

That's all the configuration the plugins themselves need here — the Better Auth config has moved to its own file (next step).

---

## Step 4 — Create `src/lib/auth.ts`

This is the file the better-auth CLI reads to generate schema, and the file your runtime imports to handle requests. It must export `auth` (named or default).

```ts
// strapi/src/lib/auth.ts
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';
import { dash } from '@better-auth/infra';

export const auth = betterAuth({
  database: strapiAdapter(),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.STRAPI_URL ?? 'http://localhost:1337',
  trustedOrigins: [process.env.CLIENT_URL ?? 'http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  advanced: {
    database: {
      generateId: 'serial', // align with Strapi's auto-increment integer IDs
    },
  },
  plugins: [
    jwt(),
    dash({
      apiUrl: process.env.STRAPI_URL ?? 'http://localhost:1337',
      apiKey:
        process.env.BETTER_AUTH_DASHBOARD_SECRET ??
        'strapi-internal-dashboard-key',
    }),
  ],
});
```

Things to know:

- `generateId: 'serial'` is required — Strapi uses auto-increment integers for IDs and the adapter expects this.
- `jwt()` is required by `dash()` — the dashboard signs internal requests with a JWT.
- The dashboard plugin **only works with the default `basePath`** of `/api/auth`. Do not override it.

---

## Step 5 — Add env vars

```bash
# strapi/.env
BETTER_AUTH_SECRET=replace-with-a-long-random-string
BETTER_AUTH_DASHBOARD_SECRET=replace-with-another-long-random-string

# Optional — defaults shown
STRAPI_URL=http://localhost:1337
CLIENT_URL=http://localhost:3000
```

Generate the secrets however you like (`openssl rand -base64 32` works).

---

## Step 6 — Seed Public role permissions on bootstrap

`plugin-api-permissions` seeds **Public** and **Authenticated** roles automatically, but with **zero permissions**. Until you grant the Public role `find` / `findOne` on each content type, anonymous requests to `/api/*` content endpoints will return 401.

You can either toggle each permission manually in the Strapi admin UI under **Settings → API Permissions → Roles → Public**, or wire it into `bootstrap`:

```ts
// strapi/src/index.ts
import type { Core } from '@strapi/strapi';

const ROLE_UID = 'plugin::api-permissions.role' as const;
const PERMISSION_UID = 'plugin::api-permissions.permission' as const;
const PUBLIC_READ_ACTIONS = ['find', 'findOne'] as const;

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (!strapi.plugin('api-permissions')) return;

    const publicRole = await strapi
      .documents(ROLE_UID)
      .findFirst({ filters: { type: 'public' } });

    if (!publicRole) {
      strapi.log.warn('[bootstrap] Public role not found — skipping permission seed.');
      return;
    }

    const apiContentTypeUids = Object.keys(strapi.contentTypes).filter((uid) =>
      uid.startsWith('api::'),
    );

    const existing = await strapi
      .documents(PERMISSION_UID)
      .findMany({
        filters: { role: { documentId: publicRole.documentId } },
        fields: ['action'],
      });
    const existingActions = new Set(existing.map((p) => p.action));

    for (const uid of apiContentTypeUids) {
      for (const action of PUBLIC_READ_ACTIONS) {
        const actionKey = `${uid}.${action}`;
        if (existingActions.has(actionKey)) continue;
        await strapi.documents(PERMISSION_UID).create({
          data: { action: actionKey, role: publicRole.id as never },
        });
      }
    }
  },
};
```

The action format is `<content-type-uid>.<action>` (e.g. `api::article.article.find`). The bootstrap is idempotent — re-runs skip permissions that already exist.

---

## Step 7 — Generate the Better Auth schema

The better-auth plugin ships with **zero content types**. The schema is generated from your `auth.ts` config. Each plugin you enable in better-auth (`jwt()`, `dash()`, etc.) contributes additional fields or tables.

```bash
# from your Strapi project root
yarn exec better-auth generate --config src/lib/auth.ts --yes
```

This writes schema files to `src/extensions/better-auth/content-types/`:

```
src/extensions/better-auth/content-types/
  account/schema.json
  jwks/schema.json        # added by jwt()
  session/schema.json
  user/schema.json
  verification/schema.json
```

Tables are prefixed with `ba_` by default (`ba_user`, `ba_session`, …). Re-run the generator any time you add or remove a Better Auth plugin.

---

## Step 8 — Configure the Next.js client

Install Better Auth in your frontend:

```bash
# from your Next.js project root
yarn add better-auth
```

Create the client:

```ts
// next/lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL ?? 'http://localhost:1337';

export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

**Important:** the endpoint path is `/api/auth`, not `/api/better-auth`. The endpoint was renamed in `1.0.0-beta.1`.

---

## Step 9 — Use auth in components

A minimal sign-up form:

```tsx
// next/components/sign-up.tsx
'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { signUp } from '@/lib/auth-client';

export function SignUp() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'en';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { error } = await signUp.email({ email, password, name });
    if (error) return setError(error.message ?? 'Sign up failed');
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required minLength={8} />
      {error && <p>{error}</p>}
      <button type="submit">Sign up</button>
    </form>
  );
}
```

A user menu that reflects the current session:

```tsx
// next/components/user-menu.tsx
'use client';

import { signOut, useSession } from '@/lib/auth-client';

export function UserMenu() {
  const { data: session, isPending } = useSession();
  if (isPending || !session?.user) return null;
  const name = session.user.name || session.user.email;
  return (
    <div>
      <span>Hi {name}</span>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  );
}
```

Social sign-in (after configuring providers in `src/lib/auth.ts`):

```ts
await signIn.social({ provider: 'github', callbackURL: '/' });
```

---

## Step 10 — Run it

```bash
# terminal 1
cd strapi && yarn develop

# terminal 2
cd next && yarn dev
```

Open:

- **http://localhost:1337/admin** — Strapi admin. After logging in, look for the **Better Auth** plugin in the left nav (the dashboard) and **Settings → API Permissions** for the RBAC UI.
- **http://localhost:3000** — your frontend.

---

## Verifying the install

| Check | Expected |
| --- | --- |
| `curl http://localhost:1337/api/global` | `200` with content (means Public role permissions were seeded) |
| `curl -X POST http://localhost:1337/api/auth/sign-up/email -H 'content-type: application/json' -d '{"email":"a@b.c","password":"testpass1234","name":"A"}'` | `200` with `{token, user: {id, ...}}` |
| After sign-up via your frontend | Navbar shows `Hi <name>` and `Logout` button |
| Strapi admin → **Better Auth** tab | User list, sessions, growth chart |
| Strapi admin → **Settings → API Permissions** | Public + Authenticated roles, per-content-type permission toggles |

---

## Troubleshooting

**`Error: The 'users-permissions' plugin is installed.`**
Remove `@strapi/plugin-users-permissions` from `package.json` (Step 1). Disabling it in `config/plugins.ts` is not enough.

**`401 Unauthorized` on every `/api/*` content endpoint**
The Public role has no permissions yet. Run your Strapi server once so `plugin-api-permissions` seeds the roles, then either run the bootstrap from Step 6 or toggle permissions in **Settings → API Permissions → Roles → Public**.

**`Cannot find package '@better-auth/core'`** (from `yarn dlx @better-auth/cli ...`)
The CLI's isolated env can't see your project's hoisted node_modules. Install the CLI locally (`yarn add -D @better-auth/cli`) and call it via `yarn exec better-auth ...`. If it still fails, ensure `@better-auth/core` is a direct top-level dependency (`yarn add @better-auth/core`).

**`TypeError: z.email is not a function`** (during `better-auth generate`)
Zod 3.x is winning the hoist. Pin `zod@^4.1.12` at the top of your strapi `package.json` and reinstall.

**`Strapi v5.42.x is not supported. Please upgrade to v5.45.0 or higher.`**
Upgrade Strapi and matching plugins to 5.45+ (5.46+ recommended).

**Dashboard shows but `/better-auth-dashboard/db` returns 401**
Check that `dash({ apiKey: ... })` and `BETTER_AUTH_DASHBOARD_SECRET` agree, and that the admin panel UI is calling the same instance (no separate Strapi URL).

**`router.push('/')` after sign-up returns 404 in a localized app**
The Next i18n middleware needs a locale prefix. Push to `\`/${locale}\`` instead of `/` from your auth forms.

---

## How this maps to the old users-permissions setup

| Concern | users-permissions | better-auth stack |
| --- | --- | --- |
| User content type | `plugin::users-permissions.user` | `plugin::better-auth.user` (table `ba_user`) |
| Sign-up / sign-in | `/api/auth/local/register`, `/api/auth/local` | `/api/auth/sign-up/email`, `/api/auth/sign-in/email` |
| JWT issuance | built-in | `better-auth` cookie session + optional `jwt()` plugin |
| Public role permissions | `Settings → Users & Permissions → Roles → Public` | `Settings → API Permissions → Roles → Public` (provided by `plugin-api-permissions`) |
| Admin UI for users | `Content Manager → User` | `Better Auth` dashboard tab |
| Frontend SDK | none — fetch by hand | `better-auth/react` (`useSession`, `signIn`, `signUp`, `signOut`) |

---

## Useful links

### Monorepo & top-level docs

- Repo (root): https://github.com/strapi-community/plugin-better-auth
- Docs site: https://strapi-community.github.io/plugin-better-auth/
- Docs intro: https://strapi-community.github.io/plugin-better-auth/docs/intro
- Migration page ("Migrate from U&P"): https://strapi-community.github.io/plugin-better-auth/docs/migration

### `plugin-better-auth`

- Source: https://github.com/strapi-community/plugin-better-auth/tree/main/plugins/plugin-better-auth
- npm: https://www.npmjs.com/package/@strapi-community/plugin-better-auth
- Releases (all versions): https://github.com/strapi-community/plugin-better-auth/releases
- Release notes — 1.0.0-beta.1 (changelog referenced in this guide): https://github.com/strapi-community/plugin-better-auth/releases/tag/1.0.0-beta.1
- Release notes — 1.0.0-beta.6 (currently latest at time of writing): https://github.com/strapi-community/plugin-better-auth/releases/tag/1.0.0-beta.6
- Installation docs: https://strapi-community.github.io/plugin-better-auth/docs/better-auth/installation
- Configuration docs: https://strapi-community.github.io/plugin-better-auth/docs/better-auth/configuration
- Schema docs (table prefix, custom tables, `auth generate`): https://strapi-community.github.io/plugin-better-auth/docs/better-auth/schema
- Client setup docs: https://strapi-community.github.io/plugin-better-auth/docs/better-auth/client-setup
- Server usage docs: https://strapi-community.github.io/plugin-better-auth/docs/better-auth/server-usage
- The U&P-incompatibility guard (source): https://github.com/strapi-community/plugin-better-auth/blob/main/plugins/plugin-better-auth/server/src/register.ts

### `plugin-api-permissions`

- Source: https://github.com/strapi-community/plugin-better-auth/tree/main/plugins/plugin-api-permissions
- npm: https://www.npmjs.com/package/@strapi-community/plugin-api-permissions
- README (install + how it works): https://github.com/strapi-community/plugin-better-auth/blob/main/plugins/plugin-api-permissions/README.md

### `plugin-better-auth-dashboard`

- Source: https://github.com/strapi-community/plugin-better-auth/tree/main/plugins/plugin-better-auth-dashboard
- npm: https://www.npmjs.com/package/@strapi-community/plugin-better-auth-dashboard
- README (install + `jwt()` + `dash()` config): https://github.com/strapi-community/plugin-better-auth/blob/main/plugins/plugin-better-auth-dashboard/README.md
- Dashboard docs page: https://strapi-community.github.io/plugin-better-auth/docs/better-auth/dashboard

### Better Auth (upstream library)

- Site: https://better-auth.com
- Docs (root): https://better-auth.com/docs
- Database concepts (schema generation, custom tables): https://better-auth.com/docs/concepts/database
- `jwt()` plugin docs: https://better-auth.com/docs/plugins/jwt
- React client docs: https://better-auth.com/docs/integrations/next
- CLI reference (`better-auth generate`): https://better-auth.com/docs/concepts/cli

### Companion npm packages used in this guide

- `better-auth`: https://www.npmjs.com/package/better-auth
- `@better-auth/cli`: https://www.npmjs.com/package/@better-auth/cli
- `@better-auth/core`: https://www.npmjs.com/package/@better-auth/core
- `@better-auth/infra` (used by the dashboard's `dash()` plugin): https://www.npmjs.com/package/@better-auth/infra
- `zod` (must be `^4.1.12`+): https://www.npmjs.com/package/zod

### Strapi

- Strapi docs: https://docs.strapi.io
- Strapi v5 plugin development: https://docs.strapi.io/cms/plugins-development/developing-plugins
- Strapi releases: https://github.com/strapi/strapi/releases
