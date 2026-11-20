<script setup lang="ts">
import { withBase } from 'vitepress'
import { data as modules } from '../../modules.data.ts'
import { data as services } from '../../services.data.ts'
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>Module</th>
        <th>Stable Version</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="m in modules" :key="m.name">
        <td><a :href="withBase(m.link)">{{ m.title }}</a></td>
        <td><code>{{ m.version }}</code></td>
      </tr>
      <tr v-for="s in services" :key="'svc-' + s.name">
        <td><a :href="withBase(s.link)">{{ s.title }}</a> (service)</td>
        <td><code>{{ s.version }}</code></td>
      </tr>
    </tbody>
  </table>
</template>
