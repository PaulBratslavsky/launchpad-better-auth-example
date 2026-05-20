import type { Core } from '@strapi/strapi';

const ROLE_UID = 'plugin::api-permissions.role';
const PERMISSION_UID = 'plugin::api-permissions.permission';
const PUBLIC_READ_ACTIONS = ['find', 'findOne'] as const;

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (!strapi.plugin('api-permissions')) return;
    if (!strapi.contentTypes['plugin::better-auth.user' as never]) {
      strapi.log.warn(
        '[bootstrap] better-auth content types not found — run `yarn exec better-auth generate --config src/lib/auth.ts --yes` first.',
      );
      return;
    }

    const documents = strapi.documents as any;

    const publicRole = await documents(ROLE_UID).findFirst({
      filters: { type: 'public' },
    });

    if (!publicRole) {
      strapi.log.warn('[bootstrap] Public role not found — skipping permission seed.');
      return;
    }

    const apiContentTypeUids = Object.keys(strapi.contentTypes).filter((uid) =>
      uid.startsWith('api::'),
    );

    const existing: Array<{ action: string }> = await documents(PERMISSION_UID).findMany({
      filters: { role: { documentId: publicRole.documentId } },
      fields: ['action'],
    });
    const existingActions = new Set(existing.map((p) => p.action));

    for (const uid of apiContentTypeUids) {
      for (const action of PUBLIC_READ_ACTIONS) {
        const actionKey = `${uid}.${action}`;
        if (existingActions.has(actionKey)) continue;
        await documents(PERMISSION_UID).create({
          data: { action: actionKey, role: publicRole.id },
        });
      }
    }
  },
};
