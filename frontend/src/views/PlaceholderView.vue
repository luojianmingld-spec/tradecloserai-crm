<template>
  <div class="placeholder-page">
    <div class="placeholder-card">
      <div class="placeholder-icon">🚧</div>
      <h2>{{ title }}</h2>
      <p>{{ desc }}</p>
      <span class="badge">Phase {{ phase }} 开发中</span>
    </div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const m = { 'doc-agent': ['单证Agent','智能单证管理：自动识别报关单、提单、发票，AI审核单据一致性','2'], 'freight-agent': ['货代Agent','货代智能对接：企业微信直连货代，自动询价/订舱/物流跟踪','3-4'] }
const i = computed(() => m[route.path.slice(1)] || ['Agent','开发中','?'])
const title = computed(() => i.value[0])
const desc = computed(() => i.value[1])
const phase = computed(() => i.value[2])
</script>
<style scoped>
.placeholder-page { display:flex; align-items:center; justify-content:center; min-height:60vh; padding:24px; }
.placeholder-card { text-align:center; background:var(--mgmt-card-bg); border:1px solid var(--mgmt-divider); border-radius:16px; padding:48px 32px; max-width:380px; }
.placeholder-icon { font-size:56px; margin-bottom:16px; }
h2 { font-size:20px; color:var(--text-primary); margin:0 0 8px; }
p { font-size:14px; color:var(--text-secondary); line-height:1.6; margin:0 0 20px; }
.badge { background:rgba(0,168,132,0.15); color:var(--accent); font-size:12px; font-weight:600; padding:4px 14px; border-radius:20px; }
</style>
