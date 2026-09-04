<template>
  <div class="agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>🏭 工厂对接</h1>
        <span class="subtitle">Factory Management · 供应链管理 · 品质管控</span>
      </div>
      <div class="header-actions">
        <button class="btn-action" @click="goBack">← 返回Agent</button>
      </div>
    </div>
    <div class="agent-body">
      <div class="section-title">核心能力</div>
      <div class="feature-grid">
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">🏗️</div>
          <h3>验厂评估</h3>
          <p>工厂资质审核、产能评估、质量体系检查</p>
        </div>
        <div class="feature-card" @click="go('/pipeline')">
          <div class="fc-icon">📦</div>
          <h3>生产跟进</h3>
          <p>订单进度追踪、交期预警、异常上报</p>
        </div>
        <div class="feature-card" @click="go('/pipeline')">
          <div class="fc-icon">🔍</div>
          <h3>品质管控</h3>
          <p>来料检验、过程巡检、出货前抽检</p>
        </div>
        <div class="feature-card" @click="go('/dashboard')">
          <div class="fc-icon">💲</div>
          <h3>成本核算</h3>
          <p>报价对比、BOM分析、降本建议</p>
        </div>
        <div class="feature-card" @click="go('/product-knowledge')">
          <div class="fc-icon">📋</div>
          <h3>供应商档案</h3>
          <p>工厂信息库、历史合作记录、评分评级</p>
        </div>
        <div class="feature-card" @click="go('/chat')">
          <div class="fc-icon">💬</div>
          <h3>AI询价对比</h3>
          <p>一键向多家工厂询价，AI汇总对比报价</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const go = (path) => router.push(path)
const goBack = () => router.push('/sales-champion')
</script>
<style scoped>
.agent-page { padding: 24px; max-width: 1200px; margin: 0 auto; min-height: 100%; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.page-header h1 { font-size: 24px; margin: 0 0 4px; }
.subtitle { font-size: 14px; opacity: 0.6; }
.btn-action { padding: 8px 16px; border: 1px solid var(--mgmt-divider, #2a3942); border-radius: 8px; background: transparent; cursor: pointer; font-size: 13px; }
.btn-action:hover { border-color: var(--accent, #00a884); }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; opacity: 0.8; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.feature-card { background: var(--mgmt-card-bg, #202c33); border: 1px solid var(--mgmt-divider, #2a3942); border-radius: 12px; padding: 24px 20px; cursor: pointer; transition: all 0.2s; }
.feature-card:hover { border-color: var(--accent, #00a884); box-shadow: 0 4px 16px rgba(0,168,132,0.15); transform: translateY(-2px); }
.fc-icon { font-size: 32px; margin-bottom: 12px; }
.feature-card h3 { font-size: 16px; margin: 0 0 6px; }
.feature-card p { font-size: 13px; opacity: 0.6; margin: 0; line-height: 1.5; }
</style>
