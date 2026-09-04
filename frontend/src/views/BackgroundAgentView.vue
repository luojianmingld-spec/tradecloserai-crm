<template>
  <div class="agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>🔍 客户背调</h1>
        <span class="subtitle">Background Check · 深度背调 · 风险预警</span>
      </div>
    </div>
    <div class="agent-body">
      <div class="section-title">核心能力</div>
      <div class="feature-grid">
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">🏢</div>
          <h3>公司背景调查</h3>
          <p>工商注册、股东结构、实控人信息、经营风险</p>
        </div>
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">⚠️</div>
          <h3>信用风险评估</h3>
          <p>付款记录、信用评级、风险预警、账期建议</p>
        </div>
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">🚢</div>
          <h3>海关数据分析</h3>
          <p>进出口记录、贸易伙伴、采购量趋势、竞品供应商</p>
        </div>
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">🔎</div>
          <h3>竞品分析</h3>
          <p>同行业对比、价格区间、市场份额、竞争格局</p>
        </div>
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">📊</div>
          <h3>一键生成报告</h3>
          <p>AI自动汇总背调信息，生成专业评估报告</p>
        </div>
        <div class="feature-card" @click="go('/customers')">
          <div class="fc-icon">📡</div>
          <h3>持续监控</h3>
          <p>客户动态实时追踪，重大变化自动预警</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const go = (path) => router.push(path)
</script>
<style scoped>
.agent-page { padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; min-height: 100%; box-sizing: border-box; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.page-header h1 { font-size: 24px; margin: 0 0 4px; }
.subtitle { font-size: 14px; opacity: 0.6; }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; opacity: 0.8; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.feature-card { background: var(--mgmt-card-bg, #202c33); border: 1px solid var(--mgmt-divider, #2a3942); border-radius: 12px; padding: 24px 20px; cursor: pointer; transition: all 0.2s; }
.feature-card:hover { border-color: var(--accent, #00a884); box-shadow: 0 4px 16px rgba(0,168,132,0.15); transform: translateY(-2px); }
.fc-icon { font-size: 32px; margin-bottom: 12px; }
.feature-card h3 { font-size: 16px; margin: 0 0 6px; }
.feature-card p { font-size: 13px; opacity: 0.6; margin: 0; line-height: 1.5; }
</style>
