import { defineLoader } from 'vitepress'
import fs from 'fs'
import path from 'path'

export interface ModuleData {
  name: string
  title: string
  description: string
  version: string
  link: string
}

export default defineLoader({
  load(): ModuleData[] {
    const docsDir = path.resolve(__dirname)
    const modulesDir = path.join(docsDir, 'modules')

    // Load pre-fetched versions from CI (not present in local dev builds)
    const versionsFile = path.join(docsDir, 'modules-versions.json')
    const versions: Record<string, string> = fs.existsSync(versionsFile)
      ? JSON.parse(fs.readFileSync(versionsFile, 'utf8'))
      : {}

    const names = fs
      .readdirSync(modulesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()

    return names.map((name) => {
      const indexPath = path.join(modulesDir, name, 'index.md')
      let title = name.charAt(0).toUpperCase() + name.slice(1)
      let description = ''
      let version = '–'

      try {
        const content = fs.readFileSync(indexPath, 'utf8')
        const lines = content.split('\n')

        // Extract H1
        for (const line of lines) {
          const m = line.match(/^#\s+(.+)/)
          if (m) {
            title = m[1].trim().replace(/^SDK-/, '')
            break
          }
        }

        // Version: prefer CI-fetched value, fall back to badge/bold extraction
        if (versions[name]) {
          version = versions[name]
        } else {
          const badgeMatch = content.match(/version-(\d+\.\d+\.\d+)-blue/)
          if (badgeMatch) {
            version = `v${badgeMatch[1]}`
          } else {
            const boldMatch = content.match(/\*\*(v\d+\.\d+\.\d+)\*\*/)
            if (boldMatch) {
              version = boldMatch[1]
            }
          }
        }

        // Extract description: first non-empty line after H1 that is plain text
        let pastH1 = false
        for (const line of lines) {
          const trimmed = line.trim()

          if (!pastH1) {
            if (/^#\s+/.test(trimmed)) pastH1 = true
            continue
          }

          if (trimmed === '') continue

          // Skip lines that are not plain prose
          if (/^[#|>:`!-]/.test(trimmed) || trimmed.startsWith(':::')) continue

          // Strip inline markdown: bold, italic, code, links
          let plain = trimmed
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .trim()

          if (plain.length === 0) continue

          description = plain.length > 150 ? plain.slice(0, 149) + '…' : plain
          break
        }
      } catch {
        // unreadable — use defaults
      }

      return {
        name,
        title,
        description,
        version,
        link: `/modules/${name}/`,
      }
    })
  },
})