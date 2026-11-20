import { defineLoader } from 'vitepress'
import path from 'path'
import { loadArea, type ModuleData } from './.vitepress/lib/entries'

export type { ModuleData }

export default defineLoader({
  load(): ModuleData[] {
    return loadArea(path.resolve(__dirname), 'modules')
  },
})
