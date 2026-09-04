<template>
  <div class="agent-page">
    <div class="page-header">
      <div class="header-left">
        <h1>⚖️ 外贸法务</h1>
        <span class="subtitle">Legal & Compliance · 合同审查 · 合规风控</span>
      </div>
    </div>
    <div class="agent-body">
      <div class="section-title">核心能力</div>
      <div class="feature-grid">
        <div class="feature-card" @click="go('/assistant')">
          <div class="fc-icon">📝</div>
          <h3>合同审查</h3>
          <p>AI逐条审查合同条款，标记风险条款，提供修改建议</p>
        </div>
        <div class="feature-card" @click="go('/assistant')">
          <div class="fc-icon">⚖️</div>
          <h3>纠纷处理</h3>
          <p>贸易纠纷分析、维权方案建议、仲裁/诉讼指引</p>
        </div>
        <div class="feature-card" @click="go('/assistant')">
          <div class="fc-icon">🛡️</div>
          <h3>合规风控</h3>
          <p>出口管制筛查、制裁合规检查、反洗钱审核</p>
        </div>
        <div class="feature-card" @click="go('/assistant')">
          <div class="fc-icon">💳</div>
          <h3>付款保障</h3>
          <p>信用证风险审查、保函模板、收汇安全保障方案</p>
        </div>
        <div class="feature-card" @click="go('/assistant')">
          <div class="fc-icon">🔐</div>
          <h3>知识产权</h3>
          <p>商标注册指导、专利侵权排查、品牌保护策略</p>
        </div>
        <div class="feature-card" @click="go('/assistant')">
          <div class="fc-icon">📚</div>
          <h3>法规库</h3>
          <p>各国贸易法规查询、最新政策解读、案例参考</p>
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
