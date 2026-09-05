<template>
  <div class="skill-store-page">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">技能商店</h1>
      <p class="page-subtitle">发现和安装更多AI技能，扩展你的外贸能力</p>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">{{ totalSkills }}</div>
        <div class="stat-label">技能总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-number stat-online">{{ onlineSkills }}</div>
        <div class="stat-label">已上线</div>
      </div>
      <div class="stat-card">
        <div class="stat-number stat-coming">{{ comingSkills }}</div>
        <div class="stat-label">即将上线</div>
      </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <input v-model="searchQuery" type="text" placeholder="搜索技能..." class="search-input" />
    </div>

    <!-- Skills Grid -->
    <div class="skills-grid">
      <div
        v-for="skill in filteredSkills"
        :key="skill.name"
        class="skill-card card-clickable"
        @click="showDetail(skill)"
      >
        <div class="card-header">
          <div class="skill-icon-wrapper">
            <span class="skill-emoji">{{ skill.emoji }}</span>
          </div>
          <div class="skill-meta">
            <div class="skill-name-row">
              <span class="skill-name">{{ skill.name }}</span>
              <span
                class="status-badge"
                :class="skill.status === '已上线' ? 'badge-online' : 'badge-coming'"
              >{{ skill.status }}</span>
            </div>
            <span class="skill-category">{{ skill.category }}</span>
            <span class="skill-phase">{{ skill.phase }}</span>
          </div>
        </div>
        <p class="skill-desc">{{ skill.desc }}</p>
        <div class="skill-tags">
          <span v-for="tag in skill.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <button
          class="action-btn"
          :class="skill.status === '已上线' ? 'btn-installed' : 'btn-coming'"
        >
          {{ skill.status === '已上线' ? '查看详情' : '敬请期待' }}
        </button>
      </div>
    </div>

    <!-- 技能详情弹窗 -->
    <div v-if="activeSkill" class="detail-overlay" @click.self="closeDetail">
      <div class="detail-modal">
        <div class="modal-header">
          <div class="modal-icon">
            <span class="modal-emoji">{{ activeSkill.emoji || '🧩' }}</span>
          </div>
          <div class="modal-title-area">
            <div class="modal-name-row">
              <span class="modal-name">{{ activeSkill.name }}</span>
              <span class="status-badge" :class="activeSkill.status === '已上线' ? 'badge-online' : 'badge-coming'">{{ activeSkill.status }}</span>
            </div>
            <div class="modal-sub">{{ activeSkill.desc }}</div>
          </div>
          <button class="modal-close" @click="closeDetail">✕</button>
        </div>

        <div class="modal-tags-row">
          <span class="modal-tag">官方技能</span>
          <span class="modal-tag">免费</span>
          <span class="modal-tag">{{ activeSkill.phase }}</span>
          <span class="modal-tag">v1.0</span>
        </div>

        <div class="modal-section">
          <h3 class="modal-section-title">详细介绍</h3>
          <div class="modal-detail-list">
            <p v-for="(line, i) in detailLines" :key="i" class="modal-detail-line">{{ line }}</p>
          </div>
        </div>

        <div class="modal-section">
          <h3 class="modal-section-title">能力标签</h3>
          <div class="skill-tags">
            <span v-for="tag in activeSkill.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="modal-action-btn" :class="activeSkill.status === '已上线' ? 'btn-installed' : 'btn-coming'" @click="closeDetail">
            {{ activeSkill.status === '已上线' ? '已安装' : '敬请期待' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const searchQuery = ref('');
const activeSkill = ref(null);

const skills = ref([
  { name:'智能获客', category:'营销获客', desc:'从全球采购商数据库挖掘高意向线索，AI评分筛选', tags:['全球企业库搜索','AI意向评分','批量导出','CRM同步'], status:'即将上线', phase:'第二期', emoji:'🎯' },
  { name:'市场分析', category:'营销获客', desc:'分析目标市场规模、竞争格局、采购趋势，生成市场报告', tags:['市场规模分析','竞争格局','趋势预测','报告生成'], status:'已上线', phase:'第一期', emoji:'📊' , detail:'输入目标市场或行业，自动生成市场规模、增速与需求趋势分析；\n竞品格局与主要玩家画像拆解，识别差异化切入机会；\n输出结构化市场报告，支撑选品与进入策略决策。' },
  { name:'社媒营销', category:'营销获客', desc:'LinkedIn、Facebook等社媒平台自动获客和内容营销', tags:['自动添加好友','内容发布','互动管理','数据分析'], status:'即将上线', phase:'第三期', emoji:'📱' },
  { name:'谷歌SEO优化', category:'营销获客', desc:'关键词研究、网站结构优化、内容SEO建议，提升Google排名', tags:['关键词研究','网站诊断','内容优化','排名追踪'], status:'即将上线', phase:'第三期', emoji:'🔍' },
  { name:'内容营销', category:'营销获客', desc:'博客文章、产品描述、Landing Page文案自动生成', tags:['博客文章','产品描述','Landing Page','SEO优化'], status:'即将上线', phase:'第三期', emoji:'✍️' },
  { name:'Google Ads投放', category:'营销获客', desc:'广告文案生成、关键词出价建议、投放策略优化', tags:['广告文案','关键词建议','出价策略','ROI分析'], status:'即将上线', phase:'第三期', emoji:'📢' },
  { name:'邮件自动化', category:'沟通触达', desc:'AI撰写多语种开发信，智能匹配模板，自动发送和跟进', tags:['个性化邮件生成','多语种支持','智能跟进','打开率追踪'], status:'已上线', phase:'第一期', emoji:'' , detail:'AI 根据客户背景自动撰写多语种开发信，贴近当地商务习惯；\n内置邮件模板库并智能匹配，一键套用后个性化填充；\n自动发送与跟进节奏管理，打开率、回复率数据持续追踪。' },
  { name:'多渠道实时沟通', category:'客户沟通', desc:'WhatsApp/Telegram/邮箱三渠道统一收件箱，实时对话+AI翻译+话术生成', tags:['WhatsApp','Telegram','邮箱','AI翻译','话术生成'], status:'已上线', phase:'第一期', emoji:'💬' , detail:'WhatsApp、Telegram、邮箱三渠道统一收件箱，消息实时汇聚；\nAI 自动翻译与话术生成，跨语言沟通无障碍；\n历史会话、客户信息同屏展示，沟通上下文不丢失。' },
  { name:'视频会议', category:'沟通触达', desc:'集成Zoom/Teams，AI自动生成会议纪要和跟进任务', tags:['一键发起','AI纪要','任务提取','多语言翻译'], status:'即将上线', phase:'第三期', emoji:'' },
  { name:'销售话术库', category:'沟通触达', desc:'不同销售场景的话术模板，AI智能推荐最佳沟通策略', tags:['场景话术','AI推荐','多语种','效果追踪'], status:'已上线', phase:'第一期', emoji:'🎭' , detail:'覆盖开发信、报价、谈判、催款等典型销售场景话术模板；\nAI 根据当前对话情境智能推荐最合适的沟通话术；\n多语种版本可选，效果数据追踪持续优化。' },
  { name:'多语种翻译', category:'沟通触达', desc:'英/西/法/阿/俄/葡等外贸常用语种专业翻译', tags:['专业术语','本地化润色','邮件翻译','合同翻译'], status:'已上线', phase:'第一期', emoji:'🌐' , detail:'覆盖英、西、法、阿、俄、葡等外贸常用语种；\n内置专业术语库保证行业表达准确，本地化润色更自然；\n支持邮件、合同等正式文书的翻译与校对。' },
  { name:'谈判策略', category:'沟通触达', desc:'基于客户画像的谈判技巧、让步策略、僵局破解方案', tags:['客户分析','策略推荐','话术生成','模拟演练'], status:'即将上线', phase:'第二期', emoji:'' },
  { name:'异议处理', category:'沟通触达', desc:'常见客户异议（价格、质量、交期）的智能应对方案', tags:['异议识别','应对方案','话术生成','案例参考'], status:'即将上线', phase:'第二期', emoji:'️' },
  { name:'单证生成', category:'单证合规', desc:'自动生成报价单、商业发票、合同、报关单等外贸单证', tags:['多模板选择','自动填充','格式规范','PDF导出'], status:'已上线', phase:'第一期', emoji:'📋' , detail:'自动生成报价单、商业发票、合同、报关单等外贸单证；\n多模板选择加自动填充，减少重复录入；\n格式规范、支持 PDF 一键导出，直接用于业务流转。' },
  { name:'信用证审核', category:'单证合规', desc:'L/C条款逐条解读、风险点标注、不符点预警', tags:['条款解读','风险标注','不符点预警','修改建议'], status:'即将上线', phase:'第二期', emoji:'🏦' },
  { name:'出口管制', category:'单证合规', desc:'制裁名单筛查、出口许可证检查、合规风险预警', tags:['制裁筛查','许可证检查','风险预警','合规报告'], status:'即将上线', phase:'第二期', emoji:'🔒' },
  { name:'退税计算', category:'单证合规', desc:'出口退税率查询、退税金额自动计算', tags:['税率查询','金额计算','政策更新','报表生成'], status:'即将上线', phase:'第二期', emoji:'' },
  { name:'客户背调', category:'客户管理', desc:'深度背调全球企业，分析公司规模、采购记录和信用评分', tags:['企业工商信息','采购记录分析','信用评分','风险预警'], status:'已上线', phase:'第一期', emoji:'' , detail:'深度背调全球企业，汇总工商信息与经营状况；\n采购记录与供应链线索分析，判断客户真实价值；\n信用评分与风险预警，降低坏账与合作风险。' },
  { name:'客户跟进', category:'客户管理', desc:'智能跟进提醒、跟进记录管理、客户状态追踪', tags:['跟进提醒','记录管理','状态追踪','转化分析'], status:'已上线', phase:'第一期', emoji:'' , detail:'智能跟进提醒，按客户状态自动编排跟进计划；\n跟进记录结构化沉淀，团队协作透明；\n转化漏斗分析，识别需要重点突破的客户。' },
  { name:'客户分层', category:'客户管理', desc:'RFM模型分析，识别高价值客户，制定差异化跟进策略', tags:['RFM分析','客户分层','策略推荐','价值评估'], status:'已上线', phase:'第一期', emoji:'️' , detail:'RFM 模型对客户自动分层，快速识别高价值客户；\n差异化跟进策略推荐，不同层级匹配不同力度；\n客户价值动态评估，资源向高价值客户倾斜。' },
  { name:'AI实时话术Copilot', category:'沟通触达', desc:'客户消息实时生成三种风格回复建议（正式/友好/简洁），一键发送', tags:['实时推荐','三种风格','一键发送','场景话术'], status:'已上线', phase:'第一期', emoji:'🤖' , detail:'客户消息到达时实时生成正式、友好、简洁三种回复风格；\n结合对话上下文与客户画像，回复更贴合真实场景；\n一键发送，不打断沟通节奏。' },
  { name:'询盘智能分类', category:'沟通触达', desc:'AI自动识别客户询盘7大类型（信息/价格/样品/资质/合作/拒绝/转介绍），给出应对要点和针对性回复', tags:['7类询盘识别','应对要点','针对性话术'], status:'已上线', phase:'第一期', emoji:'🏷️' , detail:'AI 自动识别询盘七大类型：信息、价格、样品、资质、合作、拒绝、转介绍；\n每种类型给出应对要点与针对性回复建议；\n自动标记优先级，重要询盘不遗漏。' },
  { name:'世界时钟与文化面板', category:'客户管理', desc:'客户当地时间/星期/节假日/文化禁忌/商务礼仪一键查看，跨时区沟通不踩雷', tags:['当地时间','节假日','文化禁忌','商务礼仪','时区换算'], status:'已上线', phase:'第一期', emoji:'🌍' , detail:'一键查看客户当地日期、时间与星期，避免时区打扰；\n节假日、文化禁忌、商务礼仪提示，跨文化沟通不踩雷；\n内置时区换算工具，预约会议更从容。' },
  { name:'客户画像', category:'客户管理', desc:'基于CRM数据生成客户360°画像报告，含采购偏好/沟通风格/文化背景/跟进建议', tags:['数据整合','行为分析','文化背景','画像报告','跟进建议'], status:'已上线', phase:'第一期', emoji:'👤' , detail:'基于 CRM 数据生成客户 360° 画像报告；\n采购偏好、沟通风格、文化背景等多维刻画；\n附具体跟进建议，把画像洞察转化为行动。' },
  { name:'客户维护', category:'客户管理', desc:'客户关系维护、节日问候、定期回访智能提醒', tags:['关系维护','节日问候','回访提醒','满意度调查'], status:'即将上线', phase:'第二期', emoji:'💝' },
  { name:'名片识别', category:'客户管理', desc:'拍照识别名片信息，自动录入CRM系统', tags:['拍照识别','自动录入','信息提取','去重检查'], status:'即将上线', phase:'第三期', emoji:'🪪' },
  { name:'货代背调', category:'物流运输', desc:'货代公司资质审核、服务质量评估、价格对比', tags:['资质审核','服务评估','价格对比','口碑查询'], status:'已上线', phase:'第一期', emoji:'🚛' , detail:'货代公司资质核验与经营状态查询；\n服务质量与口碑评估，筛掉低质货代；\n多货代价格对比，有效控制物流成本。' },
  { name:'海运费查询', category:'物流运输', desc:'海运费参考价查询、航线推荐、船期跟踪', tags:['参考运价','航线推荐','船期查询','对比分析'], status:'已上线', phase:'第一期', emoji:'' , detail:'主要航线海运费参考价查询，快速比价；\n航线推荐与船期跟踪，发货节奏更可控；\n运价趋势对比，把握订舱时机。' },
  { name:'汇率计算', category:'物流运输', desc:'实时汇率转换、锁汇建议、利润测算', tags:['实时汇率','多币种转换','锁汇建议','利润测算'], status:'已上线', phase:'第一期', emoji:'💱' , detail:'实时汇率转换，多币种自由换算；\n锁汇建议与利润测算，报价更稳；\n汇率波动提示，降低汇损风险。' },
  { name:'关税查询', category:'物流运输', desc:'各国HS编码对应的关税率、FTA优惠查询', tags:['关税率表','FTA优惠','税率对比','政策更新'], status:'即将上线', phase:'第二期', emoji:'🏛️' },
  { name:'收汇风险', category:'物流运输', desc:'付款方式风险评估（T/T、L/C、D/P、O/A）', tags:['风险评估','方式对比','建议生成','案例参考'], status:'即将上线', phase:'第二期', emoji:'⚠️' },
  { name:'生产进度跟进', category:'供应链', desc:'实时跟踪生产进度，异常预警，进度报告自动生成', tags:['进度跟踪','异常预警','报告生成','节点管理'], status:'已上线', phase:'第一期', emoji:'🏭' , detail:'实时跟踪订单生产进度，关键节点可视化；\n异常自动预警，及时介入避免延误；\n进度报告自动生成，同步客户更省心。' },
  { name:'履约跟踪', category:'供应链', desc:'跟踪生产进度和物流状态，异常预警和报告生成', tags:['物流跟踪','进度监控','异常预警','报告生成'], status:'已上线', phase:'第一期', emoji:'📦' , detail:'生产进度与物流状态一站式跟踪；\n异常预警与处理建议，交付全程可控；\n履约报告自动生成，提升客户信任。' },
  { name:'供应商管理', category:'供应链', desc:'供应商评估、比价、质量评分、交期跟踪', tags:['供应商评估','比价分析','质量评分','交期跟踪'], status:'即将上线', phase:'第二期', emoji:'🏗️' },
  { name:'质量检验', category:'供应链', desc:'QC报告生成、验货标准制定、不合格品处理', tags:['QC报告','验货标准','不合格处理','质量分析'], status:'即将上线', phase:'第二期', emoji:'✅' },
  { name:'成本核算', category:'供应链', desc:'产品成本BOM、利润率分析、报价支撑', tags:['BOM管理','成本分析','利润测算','报价支撑'], status:'即将上线', phase:'第二期', emoji:'🧮' },
  { name:'样品管理', category:'供应链', desc:'样品寄送跟踪、客户反馈收集、量产转换建议', tags:['寄送跟踪','反馈收集','量产建议','成本评估'], status:'即将上线', phase:'第三期', emoji:'' },
  { name:'库存预警', category:'供应链', desc:'安全库存计算、补货提醒、滞销品预警', tags:['安全库存','补货提醒','滞销预警','库存分析'], status:'即将上线', phase:'第三期', emoji:'📉' },
  { name:'销售看板', category:'数据分析', desc:'销售额、客户数、转化率等核心指标可视化', tags:['数据可视化','趋势分析','目标追踪','报表导出'], status:'已上线', phase:'第一期', emoji:'📈' , detail:'销售业绩核心指标（销售额、客户数、转化率）可视化看板；\n趋势分析识别增长拐点，目标完成度实时追踪；\n支持报表导出，管理层快速掌握业务全局。' },
  { name:'竞品分析', category:'数据分析', desc:'竞争对手产品、价格、渠道对比分析', tags:['竞品监控','价格对比','渠道分析','报告生成'], status:'即将上线', phase:'第二期', emoji:'' },
  { name:'趋势预测', category:'数据分析', desc:'基于历史数据预测销售趋势、季节性分析', tags:['趋势预测','季节性分析','需求预测','策略建议'], status:'即将上线', phase:'第三期', emoji:'🔮' },
  { name:'展会管理', category:'品牌展会', desc:'展前准备清单、展位设计建议、客户邀约话术', tags:['准备清单','展位设计','客户邀约','效果评估'], status:'即将上线', phase:'第三期', emoji:'🎪' },
  { name:'品牌故事', category:'品牌展会', desc:'公司介绍、品牌故事、产品视频脚本生成', tags:['公司介绍','品牌故事','视频脚本','多语种'], status:'即将上线', phase:'第三期', emoji:'📖' },
  { name:'独立站搭建', category:'品牌展会', desc:'Shopify/WordPress建站指导、产品页优化', tags:['建站指导','产品页优化','SEO建议','转化优化'], status:'即将上线', phase:'第三期', emoji:'' },
  { name:'GEO优化', category:'品牌展会', desc:'五维语义图谱+自动化GEO巡检闭环，让AI引擎优先引用你的内容', tags:['五维语义图谱','GEO巡检闭环','E-E-A-T优化','AI引用优先'], status:'即将上线', phase:'第三期', emoji:'🧠' },
]);

const totalSkills = computed(() => skills.value.length);
const onlineSkills = computed(() => skills.value.filter(s => s.status === '已上线').length);
const comingSkills = computed(() => skills.value.filter(s => s.status === '即将上线').length);

const phaseOrder = { '第一期': 1, '第二期': 2, '第三期': 3 };
const statusOrder = { '已上线': 0, '即将上线': 1 };

const sortedSkills = computed(() => {
  return [...skills.value].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 9, sb = statusOrder[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    const pa = phaseOrder[a.phase] ?? 9, pb = phaseOrder[b.phase] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
});

const filteredSkills = computed(() => {
  return sortedSkills.value.filter(s => {
    const matchSearch = !searchQuery.value ||
      s.name.includes(searchQuery.value) ||
      s.desc.includes(searchQuery.value) ||
      s.tags.some(t => t.includes(searchQuery.value));
    return matchSearch;
  });
});

function showDetail(skill) {
  activeSkill.value = skill;
}

function closeDetail() {
  activeSkill.value = null;
}

const detailLines = computed(() => {
  if (!activeSkill.value) return [];
  if (activeSkill.value.detail) {
    return activeSkill.value.detail.split('\n').filter(l => l.trim());
  }
  return [
    `「${activeSkill.value.name}」属于${activeSkill.value.category}方向，为${activeSkill.value.phase}规划能力。`,
    `正式上线后将支持：${activeSkill.value.tags.join('、')}。`,
    '该技能还在开发打磨中，敬请期待。'
  ];
});

</script>

<style scoped>
.skill-store-page {
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

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-number.stat-online {
  color: #22c55e;
}

.stat-number.stat-coming {
  color: #f59e0b;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 20px;
  gap: 10px;
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-btn {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-btn:hover {
  border-color: #3b82f6;
  color: var(--text-primary);
}

.filter-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.phase-btn {
  padding: 5px 14px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.phase-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.phase-btn.active {
  background: var(--sidebar-active);
  border-color: var(--text-muted);
  color: var(--text-primary);
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 8px;
}

.skill-card {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s;
}

.skill-card:hover {
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

.skill-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--search-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.skill-emoji {
  font-size: 22px;
}

.skill-meta {
  flex: 1;
  min-width: 0;
}

.skill-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.badge-online {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.badge-coming {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.skill-category {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.skill-phase {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

.skill-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  flex: 1;
}

.skill-tags {
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

.btn-installed {
  background: var(--sidebar-active);
  color: var(--text-primary);
}

.btn-installed:hover {
  background: #475569;
}

.btn-coming {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.btn-coming:hover {
  border-color: var(--text-muted);
  color: var(--text-secondary);
}

@media (max-width: 1200px) {
  .skills-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .skill-store-page {
    padding: 12px 14px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }

  .stats-row {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .stat-card {
    padding: 12px 8px;
  }

  .stat-number {
    font-size: 24px;
  }

  .skills-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 22px;
  }
}
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.detail-modal {
  width: 580px;
  max-width: 100%;
  max-height: 84vh;
  overflow-y: auto;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 26px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

.modal-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.modal-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--search-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-emoji {
  font-size: 30px;
}

.modal-title-area {
  flex: 1;
  min-width: 0;
}

.modal-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.modal-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  flex-shrink: 0;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.modal-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--search-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.modal-section {
  margin-top: 20px;
}

.modal-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.modal-detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-detail-line {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding-left: 14px;
  position: relative;
  margin: 0;
}

.modal-detail-line::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3b82f6;
}

.modal-footer {
  margin-top: 22px;
}

.modal-action-btn {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.modal-action-btn.btn-installed {
  background: #3b82f6;
  color: #fff;
}

.modal-action-btn.btn-installed:hover {
  background: #2563eb;
}

.modal-action-btn.btn-coming {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .detail-modal {
    padding: 18px;
  }

  .modal-icon {
    width: 44px;
    height: 44px;
  }

  .modal-emoji {
    font-size: 24px;
  }

  .modal-name {
    font-size: 17px;
  }
}
</style>
