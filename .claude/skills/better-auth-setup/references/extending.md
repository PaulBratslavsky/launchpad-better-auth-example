# Extending the setup

Once the base skill has run, the surface area for additions is `src/lib/auth.ts` — Better Auth plugins go there, and the schema regenerator picks up any new tables they need.

## Adding social providers

In `src/lib/auth.ts`, add a `socialProviders` block to the `betterAuth({...})` call:

```ts
export const auth = betterAuth({
  // ... existing config
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
```

Add the env vars to `.env`:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Configure the OAuth app callback URL at the provider as `http://localhost:1337/api/auth/callback/<provider>` for local dev (`http://localhost:1337/api/auth/callback/github`, etc.).

No schema regeneration needed — accounts get stored in the existing `ba_account` table.

The frontend `signIn.social({ provider, callbackURL })` call already in the template `register.tsx` will work as soon as the server-side config is in place. The Login with GitHub / Google buttons start functioning automatically.

## Adding two-factor authentication

```ts
import { twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  // ...
  plugins: [
    jwt(),
    dash({ /* ... */ }),
    twoFactor(),
  ],
});
```

Then regenerate the schema — the `twoFactor()` plugin adds a `ba_two_factor` table:

```bash
yarn exec better-auth generate --config src/lib/auth.ts --yes
```

Restart Strapi. The frontend SDK now exposes `authClient.twoFactor.*` methods.

## Adding magic links

```ts
import { magicLink } from 'better-auth/plugins';

export const auth = betterAuth({
  // ...
  plugins: [
    jwt(),
    dash({ /* ... */ }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Send `url` to `email` via your email provider.
        // For dev, just console.log it.
        console.log(`Magic link for ${email}: ${url}`);
      },
    }),
  ],
});
```

No schema changes — magic-link tokens live in the existing `ba_verification` table.

## Adding email verification

Set `requireEmailVerification: true` in the `emailAndPassword` block:

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
  sendResetPassword: async ({ user, url }) => { /* send email */ },
},
```

And add `emailVerification`:

```ts
emailVerification: {
  sendVerificationEmail: async ({ user, url }) => { /* send email */ },
},
```

You'll need to wire up an actual email provider (Resend, SendGrid, SMTP, etc.) — Better Auth doesn't ship one. For local dev, `console.log` the URL and click it manually.

## Adding the organization plugin

```ts
import { organization } from 'better-auth/plugins';

export const auth = betterAuth({
  // ...
  plugins: [
    jwt(),
    dash({ /* ... */ }),
    organization(),
  ],
});
```

Regenerate the schema. The `plugin-better-auth-dashboard` automatically grows an **Organizations** tab when it detects the plugin is loaded.

## Granting permissions beyond the defaults

The skill's bootstrap only grants `find` and `findOne` to the Public role. To add `create`, `update`, or `delete` for the Authenticated role (or any other role), either:

1. Use the **Settings → API Permissions → Roles** admin UI, or
2. Extend the bootstrap with another loop over `PUBLIC_READ_ACTIONS` for authenticated actions

Example: grant the Authenticated role `find`/`findOne`/`create`/`update`/`delete` on all api content types:

```ts
const authenticatedRole = await documents(ROLE_UID).findFirst({
  filters: { type: 'authenticated' },
});
const AUTHENTICATED_ACTIONS = ['find', 'findOne', 'create', 'update', 'delete'] as const;

for (const uid of apiContentTypeUids) {
  for (const action of AUTHENTICATED_ACTIONS) {
    const actionKey = `${uid}.${action}`;
    // ... same idempotent create
  }
}
```

## Changing the table prefix

If you don't want `ba_*` table names (e.g. you're migrating an existing project and want to keep the old names), see the [plugin docs](https://strapi-community.github.io/plugin-better-auth/docs/better-auth/schema) for the `table_prefix` option on `plugin-better-auth` in `config/plugins.ts`. The default `ba_` is fine for new projects.

## Pre-release health check

All three Better Auth plugins are pre-release. Before adopting a new minor version, run `yarn exec better-auth generate --config src/lib/auth.ts --yes` and boot Strapi to catch breaking schema changes. The plugins follow Better Auth's release cadence, so check the [Better Auth release notes](https://github.com/better-auth/better-auth/releases) alongside the Strapi plugin's release notes.
