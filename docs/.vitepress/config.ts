import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const docsDir = path.resolve(__dirname, '..')

/** Extract the text of the first `# Heading` in a markdown file. */
function extractH1(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^#\s+(.+)/)
      if (m) return m[1].trim()
    }
  } catch {
    // file unreadable — fall through
  }
  const base = path.basename(filePath, '.md')
  return base.charAt(0).toUpperCase() + base.slice(1).replace(/-/g, ' ')
}

/** Return sorted directory names under docs/<area>/ (empty if the area does not exist yet). */
function areaNames(area: 'modules' | 'services'): string[] {
  const modulesDir = path.join(docsDir, area)
  if (!fs.existsSync(modulesDir)) return []
  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/** Build sidebar items for a single module/service directory. */
function areaSidebarItems(area: 'modules' | 'services', name: string) {
  const dir = path.join(docsDir, area, name)
  const files = fs
    .readdirSync(dir)
    .filter(
      (f) =>
        f.endsWith('.md') &&
        f !== '.gitkeep' &&
        f !== 'CHANGES.md'
    )
    .sort()

  const items: { text: string; link: string }[] = []

  // index.md always first
  if (files.includes('index.md')) {
    items.push({ text: 'Overview', link: `/${area}/${name}/` })
  }

  for (const file of files) {
    if (file === 'index.md') continue
    const stem = file.replace(/\.md$/, '')
    const text = extractH1(path.join(dir, file))
    items.push({ text, link: `/${area}/${name}/${stem}` })
  }

  return items
}

/** Capitalise the first letter of a string. */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Dynamic nav items for the Modules dropdown
// ---------------------------------------------------------------------------

const navModuleItems = areaNames('modules').map((name) => ({
  text: cap(name),
  link: `/modules/${name}/`,
}))

const navServiceItems = areaNames('services').map((name) => ({
  text: cap(name),
  link: `/services/${name}/`,
}))

// ---------------------------------------------------------------------------
// Dynamic sidebar for /modules/
// ---------------------------------------------------------------------------

const modulesSidebar = areaNames('modules').map((name) => ({
  text: cap(name),
  collapsed: name !== 'foundation',
  items: areaSidebarItems('modules', name),
}))

// Dynamic sidebar for /services/ (deployable services, separate from modules)
const servicesSidebar = areaNames('services').map((name) => ({
  text: cap(name),
  collapsed: true,
  items: areaSidebarItems('services', name),
}))

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

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
        items: navModuleItems,
      },
      {
        text: 'Services',
        items: [{ text: 'Overview', link: '/services/' }, ...navServiceItems],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Templates', link: '/guide/templates' },
          { text: 'Manuelle Integration', link: '/guide/manual-setup' },
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
            { text: 'Templates', link: '/guide/templates' },
            { text: 'Manuelle Integration', link: '/guide/manual-setup' },
            { text: 'NuGet Access', link: '/guide/nuget-access' },
            { text: 'Create a Module', link: '/guide/create-module' },
            { text: 'Migrations', link: '/guide/migrations' },
            { text: 'Cross-Module Integration', link: '/guide/cross-module' },
          ],
        },
      ],

      '/modules/': modulesSidebar,

      '/services/': [
        { text: 'Services', items: [{ text: 'Overview', link: '/services/' }] },
        ...servicesSidebar,
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
