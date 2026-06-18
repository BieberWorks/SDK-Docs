import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BieberWorks SDK',
  description: 'Official documentation for the BieberWorks SDK',
  base: '/SDK-Docs/',
  ignoreDeadLinks: true,

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Modules', link: '/modules/foundation/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Module Integration', link: '/guide/module-integration' },
          ]
        }
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
          ]
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
          ]
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
          ]
        },
        {
          text: 'Audit',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/audit/' },
            { text: 'Setup', link: '/modules/audit/setup' },
            { text: 'Auto-Auditing', link: '/modules/audit/auto-auditing' },
            { text: 'IAuditService', link: '/modules/audit/audit-service' },
          ]
        },
        {
          text: 'Localization',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/localization/' },
            { text: 'Setup', link: '/modules/localization/setup' },
            { text: 'Usage', link: '/modules/localization/usage' },
          ]
        },
        {
          text: 'Settings',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/settings/' },
            { text: 'Setup', link: '/modules/settings/setup' },
            { text: 'Usage', link: '/modules/settings/usage' },
          ]
        },
        {
          text: 'Email',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/email/' },
            { text: 'Setup', link: '/modules/email/setup' },
            { text: 'Usage', link: '/modules/email/usage' },
          ]
        },
        {
          text: 'UI',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/ui/' },
            { text: 'Setup', link: '/modules/ui/setup' },
            { text: 'Components', link: '/modules/ui/components' },
          ]
        },
        {
          text: 'Admin',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/admin/' },
            { text: 'Setup', link: '/modules/admin/setup' },
            { text: 'Custom Pages', link: '/modules/admin/custom-pages' },
          ]
        },
        {
          text: 'Account',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/account/' },
            { text: 'Setup', link: '/modules/account/setup' },
            { text: 'Custom Pages', link: '/modules/account/custom-pages' },
          ]
        },
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/BieberWorks' }
    ],

    footer: {
      message: 'Proprietary — All rights reserved.',
      copyright: 'Copyright © BieberWorks'
    },

    search: {
      provider: 'local'
    }
  }
})
