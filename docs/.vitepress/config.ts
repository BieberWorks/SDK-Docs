import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BieberWorks SDK',
  description: 'Official documentation for the BieberWorks SDK — modular .NET NuGet ecosystem.',
  base: '/SDK-Docs/',
  ignoreDeadLinks: true,

  markdown: {
    lineNumbers: true,
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Getting Started', link: '/guide/getting-started' },
      {
        text: 'Modules',
        items: [
          { text: 'Foundation', link: '/modules/foundation/' },
          { text: 'Auth', link: '/modules/auth/' },
          { text: 'Email', link: '/modules/email/' },
          { text: 'Audit', link: '/modules/audit/' },
          { text: 'UI', link: '/modules/ui/' },
          { text: 'Admin', link: '/modules/admin/' },
          { text: 'Localization', link: '/modules/localization/' },
          { text: 'Storage', link: '/modules/storage/' },
          { text: 'Account', link: '/modules/account/' },
          { text: 'Settings', link: '/modules/settings/' },
          { text: 'Notifications', link: '/modules/notifications/' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'NuGet Access', link: '/guide/nuget-access' },
          { text: 'Create a Module', link: '/guide/create-module' },
          { text: 'Migrations', link: '/guide/migrations' },
          { text: 'Cross-Module Integration', link: '/guide/cross-module' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guides',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'NuGet Access', link: '/guide/nuget-access' },
            { text: 'Create a Module', link: '/guide/create-module' },
            { text: 'Migrations', link: '/guide/migrations' },
            { text: 'Cross-Module Integration', link: '/guide/cross-module' },
          ],
        },
      ],

      '/modules/': [
        {
          text: 'Foundation',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/modules/foundation/' },
            { text: 'SharedKernel', link: '/modules/foundation/shared-kernel' },
            { text: 'IModule & Setup', link: '/modules/foundation/imodule' },
            { text: 'Messaging', link: '/modules/foundation/messaging' },
          ],
        },
        {
          text: 'Account',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/account/' },
            { text: 'Setup', link: '/modules/account/setup' },
            { text: 'Custom Pages', link: '/modules/account/custom-pages' },
          ],
        },
        {
          text: 'Admin',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/admin/' },
            { text: 'Setup', link: '/modules/admin/setup' },
            { text: 'Custom Pages', link: '/modules/admin/custom-pages' },
            { text: 'Navigation', link: '/modules/admin/navigation' },
          ],
        },
        {
          text: 'Audit',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/audit/' },
            { text: 'Setup', link: '/modules/audit/setup' },
            { text: 'Auto-Auditing', link: '/modules/audit/auto-auditing' },
            { text: 'IAuditService', link: '/modules/audit/audit-service' },
          ],
        },
        {
          text: 'Auth',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/auth/' },
            { text: 'Setup', link: '/modules/auth/setup' },
            { text: 'Auth Flows', link: '/modules/auth/auth-flows' },
            { text: 'Roles & Permissions', link: '/modules/auth/roles-permissions' },
            { text: 'UI Components', link: '/modules/auth/ui-components' },
          ],
        },
        {
          text: 'Email',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/email/' },
            { text: 'Setup', link: '/modules/email/setup' },
            { text: 'Usage', link: '/modules/email/usage' },
          ],
        },
        {
          text: 'Localization',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/localization/' },
            { text: 'Setup', link: '/modules/localization/setup' },
            { text: 'Usage', link: '/modules/localization/usage' },
          ],
        },
        {
          text: 'Notifications',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/notifications/' },
            { text: 'Installation', link: '/modules/notifications/installation' },
            { text: 'Usage', link: '/modules/notifications/usage' },
          ],
        },
        {
          text: 'Settings',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/settings/' },
            { text: 'Setup', link: '/modules/settings/setup' },
            { text: 'Usage', link: '/modules/settings/usage' },
          ],
        },
        {
          text: 'Storage',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/storage/' },
            { text: 'Setup', link: '/modules/storage/setup' },
            { text: 'Providers', link: '/modules/storage/providers' },
            { text: 'Key Strategy & Visibility', link: '/modules/storage/key-strategy' },
            { text: 'UI Components', link: '/modules/storage/ui-components' },
          ],
        },
        {
          text: 'UI',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/ui/' },
            { text: 'Setup', link: '/modules/ui/setup' },
            { text: 'Components', link: '/modules/ui/components' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/BieberWorks' },
    ],

    footer: {
      message: 'Proprietary — All rights reserved.',
      copyright: 'Copyright © BieberWorks',
    },

    search: {
      provider: 'local',
    },
  },
})
