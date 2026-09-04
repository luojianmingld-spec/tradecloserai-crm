<template>
  <div class="assistant-view">
    <div class="welcome-container">
      <!-- Header Section -->
      <div class="welcome-header">
        <div class="welcome-icon">🤖</div>
        <h1>TradeCloser AI</h1>
        <p class="welcome-subtitle">你的24小时AI外贸销冠团队</p>

      </div>


      <!-- Agent Cards -->
      <div class="agents-section">
        <h2>🤝 选择你的AI助手</h2>
        <div class="agent-cards">
          <div 
            v-for="agent in agents" 
            :key="agent.key" 
            class="agent-card"
            @click="goToAgent(agent.key)"
          >
            <div class="agent-card-header">
              <div class="agent-icon">{{ agent.icon }}</div>
              <div class="agent-title">
                <h3>{{ agent.name }}</h3>
                <p class="agent-subtitle">{{ agent.subtitle }}</p>
              </div>
            </div>
            <p class="agent-description">{{ agent.description }}</p>
            <div class="agent-tags">
              <span v-for="tag in agent.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            <div class="agent-action">
              <span>开始使用</span>
              <span class="arrow">→</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions-section">
        <h2>⚡ 常用功能</h2>
        <div class="quick-actions-grid">
          <div class="quick-action-item" @click="goToAgent('chat')">
            <span class="qa-icon">💬</span>
            <span class="qa-text">客户沟通</span>
          </div>
          <div class="quick-action-item" @click="goToAgent('customers')">
            <span class="qa-icon">👥</span>
            <span class="qa-text">客户管理</span>
          </div>
          <div class="quick-action-item" @click="goToAgent('pipeline')">
            <span class="qa-icon">📊</span>
            <span class="qa-text">销售看板</span>
          </div>
          <div class="quick-action-item" @click="goToAgent('dashboard')">
            <span class="qa-icon">📈</span>
            <span class="qa-text">数据概览</span>
          </div>
          <div class="quick-action-item" @click="goToAgent('product-knowledge')">
            <span class="qa-icon">📦</span>
            <span class="qa-text">产品知识</span>
          </div>
          <div class="quick-action-item" @click="goToAgent('my-stats')">
            <span class="qa-icon">🏆</span>
            <span class="qa-text">我的业绩</span>
          </div>
        </div>
      </div>

      <!-- Tips Section -->
      <div class="tips-section">
        <div class="tip-card">
          <h3>💡 使用提示</h3>
          <ul>
            <li>每个Agent都有专属技能，会根据你的需求智能响应</li>
            <li>Agent生成的文件会自动保存到对应的文件工作区，随时可以下载</li>
            <li>支持多轮对话，可以持续优化结果</li>
            <li>遇到问题可以随时切换Agent获取不同角度的建议</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'

export default {
  name: 'AssistantView',
  setup() {
    const router = useRouter()

    const agents = [
      {
        key: 'sales-champion',
        icon: '🏆',
        name: '外贸销冠',
        subtitle: 'Sales Champion',
        description: '智能跟单助手，帮你管理客户关系、优化报价话术、提升成交转化率',
        tags: ['AI话术', '客户分层', '报价优化', '跟进提醒']
      },
      {
        key: 'background-report',
        icon: '🔍',
        name: '客户背调',
        subtitle: 'Background Check',
        description: '深度客户背景调查，评估信用风险，分析竞争对手，知己知彼',
        tags: ['公司背调', '风险评估', '竞品分析', '海关数据']
      },
      {
        key: 'customs-agent',
        icon: '📋',
        name: '外贸单证',
        subtitle: 'Customs & Documents',
        description: '专业单证处理，报关单证、HS编码查询、信用证审核一站式服务',
        tags: ['报关单证', 'HS编码', '信用证审核', '合规检查']
      },
      {
        key: 'doc-agent',
        icon: '🏭',
        name: '工厂对接',
        subtitle: 'Factory Management',
        description: '供应链管理专家，验厂评估、生产跟进、品质管控、成本优化',
        tags: ['验厂评估', '生产跟进', '品质管控', '成本核算']
      },
      {
        key: 'freight-agent',
        icon: '🚢',
        name: '货代对接',
        subtitle: 'Freight & Logistics',
        description: '国际物流专家，海运空运报价、报关报检、物流方案优化',
        tags: ['海运方案', '空运方案', '报关报检', '运费优化']
      },
      {
        key: 'legal-agent',
        icon: '⚖️',
        name: '外贸法务',
        subtitle: 'Legal & Compliance',
        description: '法律保障顾问，合同审查、纠纷处理、合规风控、知识产权保护',
        tags: ['合同审查', '纠纷处理', '合规风控', '付款保障']
      }
    ]

    const goToAgent = (agentKey) => {
      router.push('/' + agentKey)
    }

    return {
      agents,
      goToAgent
    }
  }
}
</script>

<style scoped>
.assistant-view {
  min-height: 100vh;
  background: var(--mgmt-bg, #151a1f);
  padding: 40px 20px;
  overflow-y: auto;
}

.welcome-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Header Section */
.welcome-header {
  text-align: center;
  margin-bottom: 48px;
  color: white;
}

.welcome-icon {
  font-size: 80px;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.welcome-header h1 {
  font-size: 42px;
  font-weight: 700;
  margin: 0 0 12px 0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.welcome-subtitle {
  font-size: 20px;
  margin: 0 0 32px 0;
  opacity: 0.95;
  font-weight: 300;
}

.feature-badges {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.feature-badge {
  background: var(--mgmt-card-bg, #1e252b);
  backdrop-filter: blur(10px);
  padding: 12px 20px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.badge-icon {
  font-size: 20px;
}

/* Quick Start Section */
.quick-start-section {
  background: var(--mgmt-card-bg, #1e252b);
  border-radius: 20px;
  padding: 32px;
  margin-bottom: 32px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.quick-start-section h2 {
  font-size: 24px;
  margin: 0 0 24px 0;
  color: var(--text-primary, #e9edef);
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.step {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 200px;
  background: var(--mgmt-bg, #151a1f);
  padding: 20px;
  border-radius: 12px;
}

.step-number {
  width: 48px;
  height: 48px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  color: var(--text-primary, #e9edef);
}

.step-content p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary, #8696a0);
}

.step-arrow {
  font-size: 24px;
  color: var(--text-secondary, #8696a0);
  flex-shrink: 0;
}

/* Agents Section */
.agents-section {
  background: var(--mgmt-card-bg, #1e252b);
  border-radius: 20px;
  padding: 32px;
  margin-bottom: 32px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.agents-section h2 {
  font-size: 24px;
  margin: 0 0 24px 0;
  color: var(--text-primary, #e9edef);
}

.agent-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.agent-card {
  background: var(--mgmt-bg, #151a1f);
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255,255,255,0.06);
  position: relative;
  overflow: hidden;
}

.agent-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.agent-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  border-color: #60a5fa;
}

.agent-card:hover::before {
  transform: scaleX(1);
}

.agent-card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.agent-icon {
  font-size: 48px;
  flex-shrink: 0;
}

.agent-title h3 {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #e9edef);
}

.agent-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary, #8696a0);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.agent-description {
  font-size: 14px;
  color: var(--text-primary, #e9edef);
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.agent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.tag {
  font-size: 11px;
  color: #60a5fa;
  background: var(--mgmt-card-bg, #1e252b);
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 500;
  border: 1px solid rgba(255,255,255,0.08);
}

.agent-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: #60a5fa;
  font-weight: 600;
}

.arrow {
  transition: transform 0.3s ease;
}

.agent-card:hover .arrow {
  transform: translateX(4px);
}

/* Quick Actions Section */
.quick-actions-section {
  background: var(--mgmt-card-bg, #1e252b);
  border-radius: 20px;
  padding: 32px;
  margin-bottom: 32px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.quick-actions-section h2 {
  font-size: 24px;
  margin: 0 0 24px 0;
  color: var(--text-primary, #e9edef);
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.quick-action-item {
  background: var(--mgmt-bg, #151a1f);
  padding: 20px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255,255,255,0.06);
}

.quick-action-item:hover {
  background: var(--mgmt-card-bg, #1e252b);
  border-color: #60a5fa;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59,130,246,0.15);
}

.qa-icon {
  font-size: 32px;
}

.qa-text {
  font-size: 14px;
  color: var(--text-primary, #e9edef);
  font-weight: 500;
  text-align: center;
}

/* Tips Section */
.tips-section {
  background: var(--mgmt-card-bg, #1e252b);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.tip-card {
  background: rgba(59,130,246,0.08);
  border-radius: 12px;
  padding: 24px;
}

.tip-card h3 {
  font-size: 20px;
  margin: 0 0 16px 0;
  color: var(--text-primary, #e9edef);
}

.tip-card ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.tip-card li {
  font-size: 14px;
  color: var(--text-primary, #e9edef);
  line-height: 1.8;
  position: relative;
  padding-left: 24px;
}

.tip-card li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #60a5fa;
  font-weight: 700;
}

/* Responsive */
@media (max-width: 768px) {
  .assistant-view {
    padding: 24px 16px;
  }

  .welcome-header h1 {
    font-size: 32px;
  }

  .welcome-subtitle {
    font-size: 16px;
  }

  .feature-badges {
    gap: 8px;
  }

  .feature-badge {
    padding: 8px 16px;
    font-size: 13px;
  }

  .quick-start-section,
  .agents-section,
  .quick-actions-section,
  .tips-section {
    padding: 20px;
  }

  .steps {
    flex-direction: column;
  }

  .step-arrow {
    transform: rotate(90deg);
  }

  .agent-cards {
    grid-template-columns: 1fr;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
/* ===== 主题适配 ===== */
[data-theme='light'] .assistant-view {
  background: var(--mgmt-bg, #f5f7fa);
}
[data-theme='light'] .welcome-header {
  color: var(--text-primary, #1a1a2e);
}
[data-theme='light'] .welcome-header h1 {
  color: var(--text-primary, #1a1a2e);
  text-shadow: none;
}
[data-theme='light'] .feature-badge {
  background: var(--mgmt-card-bg, #ffffff);
  border-color: rgba(0,0,0,0.1);
  color: var(--text-primary, #333);
}
[data-theme='light'] .quick-start-section,
[data-theme='light'] .agents-section,
[data-theme='light'] .agent-card {
  background: var(--mgmt-card-bg, #ffffff);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
[data-theme='light'] .agent-card h3,
[data-theme='light'] .step-content h4 {
  color: var(--text-primary, #1a1a2e);
}
[data-theme='light'] .agent-card p,
[data-theme='light'] .step-content p {
  color: #666;
}
[data-theme='light'] .step-number {
  background: #3b82f6;
  color: #fff;
}
[data-theme='light'] .quick-action-item {
  background: var(--mgmt-bg, #f5f7fa);
  border-color: rgba(0,0,0,0.08);
  color: var(--text-primary, #333);
}
[data-theme='light'] .quick-action-item:hover {
  background: var(--mgmt-card-bg, #ffffff);
  border-color: #60a5fa;
}

/* Dark theme overrides (explicit) */
html:not([data-theme='light']) .assistant-view {
  background: var(--mgmt-bg, #151a1f);
}
html:not([data-theme='light']) .welcome-header {
  color: var(--text-primary, #e9edef);
}
html:not([data-theme='light']) .feature-badge {
  background: var(--mgmt-card-bg, #1e252b);
  border-color: rgba(255,255,255,0.08);
  color: var(--text-primary, #e9edef);
}
</style>
