<template>
  <div class="customer-inventory-card">
    <div class="card-header">
      <h3>📊 客户盘点</h3>
      <button class="refresh-btn" @click="fetchData" :disabled="loading">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>
    
    <!-- 今日数据卡片 -->
    <div class="today-stats">
      <div class="stat-card" @click="goToStage('potential')">
        <div class="stat-icon">🆕</div>
        <div class="stat-content">
          <div class="stat-value">{{ todayData.new }}</div>
          <div class="stat-label">今日新增</div>
        </div>
      </div>
      <div class="stat-card" @click="goToStage('qualified')">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ todayData.qualified }}</div>
          <div class="stat-label">今日确认需求</div>
        </div>
      </div>
      <div class="stat-card" @click="goToStage('won')">
        <div class="stat-icon">🎉</div>
        <div class="stat-content">
          <div class="stat-value">{{ todayData.won }}</div>
          <div class="stat-label">今日成交</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-value">{{ overviewData.conversionRate }}%</div>
          <div class="stat-label">转化率</div>
        </div>
      </div>
    </div>
    
    <!-- 漏斗图 -->
    <div class="funnel-section">
      <div ref="funnelChart" class="funnel-chart"></div>
    </div>
  </div>
</template>

<script>
import api from '../utils/api.js';

export default {
  name: 'CustomerInventoryCard',
  data() {
    return {
      loading: false,
      todayData: {
        new: 0,
        qualified: 0,
        won: 0
      },
      overviewData: {
        total: 0,
        active: 0,
        won: 0,
        conversionRate: 0
      },
      funnelData: []
    };
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    async fetchData() {
      this.loading = true;
      try {
        const [funnelRes, overviewRes] = await Promise.all([
          api.get('/dashboard/funnel'),
          api.get('/dashboard/overview')
        ]);
        
        this.todayData = funnelRes.data.today;
        this.overviewData = overviewRes.data;
        this.funnelData = funnelRes.data.funnel;
        
        this.$nextTick(() => {
          this.renderFunnel();
        });
      } catch (err) {
        console.error('获取客户盘点数据失败:', err);
      } finally {
        this.loading = false;
      }
    },
    renderFunnel() {
      if (!this.$refs.funnelChart || !window.echarts) {
        // 如果ECharts未加载，延迟重试
        setTimeout(() => this.renderFunnel(), 500);
        return;
      }
      
      const chart = window.echarts.init(this.$refs.funnelChart);
      const data = this.funnelData.map(item => ({
        value: item.count,
        name: item.label,
        itemStyle: {
          color: item.color
        }
      }));
      
      const option = {
        tooltip: {
          trigger: 'item',
          formatter: function(params) {
            return `${params.name}: ${params.value}个客户`;
          }
        },
        series: [{
          name: '客户漏斗',
          type: 'funnel',
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          min: 0,
          max: Math.max(...this.funnelData.map(d => d.count), 1),
          minSize: '0%',
          maxSize: '100%',
          sort: 'none',
          gap: 2,
          label: {
            show: true,
            position: 'inside',
            formatter: function(params) {
              return `${params.name}\n${params.value}`;
            },
            fontSize: 14,
            color: '#fff'
          },
          labelLine: {
            length: 10,
            lineStyle: {
              width: 1,
              type: 'solid'
            }
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2
          },
          emphasis: {
            label: {
              fontSize: 16
            }
          },
          data: data
        }]
      };
      
      chart.setOption(option);
      
      // 响应式
      window.addEventListener('resize', () => {
        chart.resize();
      });
    },
    goToStage(stage) {
      // 跳转到客户列表，按阶段筛选
      this.$router.push({
        path: '/customers',
        query: { stage: stage }
      });
    }
  }
};
</script>

<style scoped>
.customer-inventory-card {
  background: var(--mgmt-card-bg);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  color: var(--text-primary);
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  border: 1px solid var(--mgmt-divider);
}

[data-theme="light"] .customer-inventory-card {
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.refresh-btn {
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-divider);
  color: var(--text-secondary);
  padding: 6px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--mgmt-divider);
  color: var(--text-primary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.today-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59,130,246,0.15);
  border-color: #3b82f6;
}

.stat-icon {
  font-size: 32px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.funnel-section {
  background: var(--mgmt-bg);
  border: 1px solid var(--mgmt-divider);
  border-radius: 12px;
  padding: 16px;
}

.funnel-chart {
  width: 100%;
  height: 300px;
}

@media (max-width: 768px) {
  .today-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-card {
    padding: 12px;
  }
  
  .stat-icon {
    font-size: 24px;
  }
  
  .stat-value {
    font-size: 22px;
  }
  
  .stat-label {
    font-size: 12px;
  }
  
  .funnel-chart {
    height: 250px;
  }
}</style>
