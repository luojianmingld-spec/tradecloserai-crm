<template>
  <div class="agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>📋 外贸单证</h1>
        <span class="subtitle">Customs & Documents · 报关单证 · 合规审核</span>
      </div>
    </div>
    <div class="agent-body">
      <div class="section-title">核心能力</div>
      <div class="feature-grid">
        <div class="feature-card" @click="go('/product-knowledge')">
          <div class="fc-icon">📝</div>
          <h3>报关单生成</h3>
          <p>根据订单信息自动生成报关单，支持多种格式导出</p>
        </div>
        <div class="feature-card" @click="go('/product-knowledge')">
          <div class="fc-icon">🔢</div>
          <h3>HS编码查询</h3>
          <p>智能匹配HS编码，支持中英文关键词搜索</p>
        </div>
        <div class="feature-card" @click="go('/product-knowledge')">
          <div class="fc-icon">💰</div>
          <h3>信用证审核</h3>
          <p>LC条款逐项审查，风险条款标红提示</p>
        </div>
        <div class="feature-card" @click="go('/product-knowledge')">
          <div class="fc-icon">✅</div>
          <h3>合规检查</h3>
          <p>出口管制、制裁名单、原产地规则合规校验</p>
        </div>
        <div class="feature-card" @click="go('/documents')">
          <div class="fc-icon">📄</div>
          <h3>单证模板库</h3>
          <p>商业发票、装箱单、产地证等专业模板</p>
        </div>
        <div class="feature-card" @click="go('/documents')">
          <div class="fc-icon">🤖</div>
          <h3>智能填单</h3>
          <p>AI自动填充单证字段，减少人工错误</p>
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
.agent-page { padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; min-height: 100%; }
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
