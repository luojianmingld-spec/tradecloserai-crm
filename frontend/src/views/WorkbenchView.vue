<template>
  <div class="workbench-page">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">工作台</h1>
      <p class="page-subtitle">你的外贸工作台，快速进入各功能模块</p>
    </div>

    <!-- Module Cards Grid -->
    <div class="modules-grid">
      <div
        v-for="mod in modules"
        :key="mod.key"
        class="module-card card-clickable"
        @click="goTo(mod.route)"
      >
        <div class="card-header">
          <div class="module-icon-wrapper">
            <span class="module-emoji">{{ mod.icon }}</span>
          </div>
          <div class="module-meta">
            <span class="module-name">{{ mod.name }}</span>
            <span class="module-category">{{ mod.category }}</span>
          </div>
        </div>
        <p class="module-desc">{{ mod.desc }}</p>
        <div class="module-tags">
          <span v-for="tag in mod.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <button class="action-btn btn-enter">进入模块 →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const modules = [
  {
    key: 'customers',
    name: '客户管理',
    icon: '👥',
    category: '客户运营',
    desc: '管理所有客户信息、跟进记录、客户画像，一目了然掌握客户全貌',
    tags: ['客户列表', '跟进记录', '客户画像', '分级管理'],
    route: '/customers'
  },
  {
    key: 'pipeline',
    name: '销售看板',
    icon: '📊',
    category: '销售管理',
    desc: '可视化销售漏斗，追踪每个商机的阶段与转化率，推动成交',
    tags: ['销售漏斗', '商机追踪', '阶段管理', '转化分析'],
    route: '/pipeline'
  },
  {
    key: 'dashboard',
    name: '数据概览',
    icon: '📈',
    category: '数据分析',
    desc: '核心业务指标一目了然：客户数、消息量、转化率、营收趋势',
    tags: ['核心指标', '趋势图表', '数据看板', '实时统计'],
    route: '/dashboard'
  },
  {
    key: 'my-stats',
    name: '我的业绩',
    icon: '🏆',
    category: '业绩追踪',
    desc: '个人业绩数据、目标完成度、排名情况，激励持续突破',
    tags: ['业绩统计', '目标追踪', '排名', '数据报表'],
    route: '/my-stats'
  },
  {
    key: 'trade-shows',
    name: '全球展会',
    icon: '🗓️',
    category: '展会营销',
    desc: '全球行业展会日历、展前准备清单、客户邀约与展后跟进',
    tags: ['展会日历', '展前准备', '客户邀约', '展后跟进'],
    route: '/trade-shows'
  }
];

function goTo(route) {
  router.push(route);
}
</script>

<style scoped>
.workbench-page {
  padding: 24px 28px 40px;
  width: 100%;
  min-height: auto;
  background: var(--mgmt-bg);
  color: var(--text-primary);
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 8px;
}

.module-card {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s;
}

.module-card:hover {
  border-color: #3b82f6;
}

.card-clickable {
  cursor: pointer;
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.module-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--search-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.module-emoji {
  font-size: 22px;
}

.module-meta {
  flex: 1;
  min-width: 0;
}

.module-name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.module-category {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.module-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  flex: 1;
}

.module-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  background: var(--search-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.action-btn {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-enter {
  background: var(--sidebar-active);
  color: var(--text-primary);
}

.btn-enter:hover {
  background: #475569;
}

@media (max-width: 1200px) {
  .modules-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .workbench-page {
    padding: 12px 14px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }

  .modules-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 22px;
  }
}
</style>
