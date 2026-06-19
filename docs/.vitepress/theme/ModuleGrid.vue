<script setup lang="ts">
import { withBase } from 'vitepress'
import { data as modules } from '../../modules.data.ts'
</script>

<template>
  <div class="module-grid">
    <a v-for="m in modules" :key="m.name" :href="withBase(m.link)" class="module-card">
      <h3>{{ m.title }}</h3>
      <p>{{ m.description }}</p>
    </a>
  </div>
</template>

<style scoped>
.module-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1.5rem 0;
}

@media (max-width: 960px) {
  .module-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .module-grid {
    grid-template-columns: 1fr;
  }
}

.module-card {
  display: block;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color 0.25s, background-color 0.25s;
}

.module-card:hover {
  border-color: var(--vp-c-brand-1);
  background-color: var(--vp-c-bg-soft);
}

.module-card h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.module-card p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
</style>
