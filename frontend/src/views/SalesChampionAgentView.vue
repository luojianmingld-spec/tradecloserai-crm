<template>
  <div class="sales-agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>🏆 外贸销冠</h1>
        <span class="subtitle">智能跟单 · AI话术 · 成交转化</span>
      </div>
    </div>
    <div class="agent-body">
      <div class="feature-grid">
        <div class="feature-card" @click="router.push('/assistant')">
          <div class="fc-icon">💬</div>
          <h3>AI 话术助手</h3>
          <p>智能回复、多语种翻译、报价策略</p>
        </div>
        <div class="feature-card" @click="gotoCustomers">
          <div class="fc-icon">📊</div>
          <h3>客户跟进</h3>
          <p>跟进提醒、客户分层、成交预测</p>
        </div>
        <div class="feature-card" @click="gotoPipeline">
          <div class="fc-icon">🎯</div>
          <h3>销售漏斗</h3>
          <p>商机管理、阶段推进、赢单分析</p>
        </div>
        <div class="feature-card" @click="gotoSpeech">
          <div class="fc-icon">📚</div>
          <h3>话术库</h3>
          <p>场景话术模板、快捷回复、团队共享</p>
        </div>
        <div class="feature-card" @click="gotoEffect">
          <div class="fc-icon">📈</div>
          <h3>效果追踪</h3>
          <p>转化率分析、响应时效、客户满意度</p>
        </div>
        <div class="feature-card" @click="gotoAutomation">
          <div class="fc-icon">⚡</div>
          <h3>自动化规则</h3>
          <p>自动跟进、定时发送、智能分配</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
const gotoCustomers = () => router.push('/customers')
const gotoPipeline = () => router.push('/pipeline')
const gotoSpeech = () => router.push('/speech-library')
const gotoEffect = () => router.push('/effect-tracking')
const gotoAutomation = () => router.push('/automation')
</script>
<style scoped>
.sales-agent-page { padding: 24px; max-width: 1200px; width: 100%; margin: 0 auto; box-sizing: border-box; min-height: 100%; background: var(--mgmt-bg, #151a1f); }
.page-header { margin-bottom: 24px; }
.page-header h1 { font-size: 24px; color: var(--text-primary, #e9edef); margin: 0 0 4px; }
.subtitle { font-size: 14px; color: var(--text-secondary, #8696a0); }
.agent-body { margin-top: 16px; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.feature-card { background: var(--mgmt-card-bg, #202c33); border: 1px solid var(--mgmt-divider, #2a3942); border-radius: 12px; padding: 24px 20px; cursor: pointer; transition: all 0.2s; }
.feature-card:hover { border-color: var(--accent, #00a884); box-shadow: 0 4px 16px rgba(0,168,132,0.15); transform: translateY(-2px); }
.fc-icon { font-size: 32px; margin-bottom: 12px; }
.feature-card h3 { font-size: 16px; color: var(--text-primary, #e9edef); margin: 0 0 6px; }
.feature-card p { font-size: 13px; color: var(--text-secondary, #8696a0); margin: 0; line-height: 1.5; }
/* ===== 亮色主题适配 ===== */
[data-theme='light'] .sales-agent-page {
  background: var(--mgmt-bg, #f5f7fa);
}
[data-theme='light'] .page-header h1 {
  color: var(--mgmt-text, #303133);
}
[data-theme='light'] .subtitle {
  color: var(--mgmt-text-secondary, #606266);
}
[data-theme='light'] .feature-card {
  background: var(--mgmt-card-bg, #ffffff);
  border-color: var(--mgmt-card-border, #ebeef5);
}
[data-theme='light'] .feature-card h3 {
  color: var(--mgmt-text, #303133);
}
[data-theme='light'] .feature-card p {
  color: var(--mgmt-text-secondary, #606266);
}
</style>
