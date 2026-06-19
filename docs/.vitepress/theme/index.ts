import DefaultTheme from 'vitepress/theme'
import ModuleGrid from './ModuleGrid.vue'
import VersionTable from './VersionTable.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: import('vue').App }) {
    app.component('ModuleGrid', ModuleGrid)
    app.component('VersionTable', VersionTable)
  },
}
