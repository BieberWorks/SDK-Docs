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
          ]
        },
        {
          text: 'Storage',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/storage/' },
          ]
        },
        {
          text: 'Email',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/email/' },
          ]
        },
        {
          text: 'Audit',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/audit/' },
          ]
        },
        {
          text: 'Localization',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/localization/' },
          ]
        },
        {
          text: 'Settings',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/settings/' },
          ]
        },
        {
          text: 'UI',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/ui/' },
          ]
        },
        {
          text: 'Admin',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/admin/' },
          ]
        },
        {
          text: 'Account',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/modules/account/' },
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
