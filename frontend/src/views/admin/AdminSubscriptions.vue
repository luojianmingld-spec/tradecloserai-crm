<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>订阅与财务管理</h2>
      <el-button type="primary" @click="showPlanDialog()" v-if="currentTab === 'plans'">+ 新建套餐</el-button>
      <el-button type="success" @click="showAssignDialog()" v-if="currentTab === 'subscriptions'">+ 分配订阅</el-button>
    </div>

    <el-tabs v-model="currentTab" type="border-card">
      <!-- 套餐管理 Tab -->
      <el-tab-pane label="套餐管理" name="plans">
        <!-- 分类筛选 -->
        <div class="tab-filter">
          <el-radio-group v-model="planCategory" size="default" @change="filterPlans">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="personal">个人版</el-radio-button>
            <el-radio-button value="team">团队版</el-radio-button>
            <el-radio-button value="enterprise">企业版</el-radio-button>
          </el-radio-group>
        </div>

        <el-table :data="filteredPlans" stripe style="width:100%" v-loading="plansLoading">
          <el-table-column prop="name" label="套餐名称" width="140" />
          <el-table-column prop="code" label="代码" width="100" />
          <el-table-column label="分类" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="getCategoryTag(row)">{{ getCategoryLabel(row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="monthlyPrice" label="月价" width="100">
            <template #default="{ row }">¥{{ row.monthlyPrice }}</template>
          </el-table-column>
          <el-table-column prop="yearlyPrice" label="年价" width="100">
            <template #default="{ row }">¥{{ row.yearlyPrice }}</template>
          </el-table-column>
          <el-table-column prop="creditsPerMonth" label="月积分" width="90" align="center" />
          <el-table-column prop="maxAccounts" label="最大账号" width="90" align="center" />
          <el-table-column prop="activeSubscribers" label="活跃订阅" width="90" align="center" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button size="small" @click="showPlanDialog(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deletePlan(row)">下架</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 订阅记录 Tab -->
      <el-tab-pane label="订阅记录" name="subscriptions">
        <div class="tab-filter">
          <el-select v-model="subFilter.status" placeholder="状态筛选" clearable style="width:140px" @change="loadSubscriptions">
            <el-option label="活跃" value="active" />
            <el-option label="已过期" value="expired" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="试用" value="trial" />
          </el-select>
        </div>
        <el-table :data="subscriptions" stripe style="width:100%" v-loading="subsLoading">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="userId" label="用户ID" width="90" />
          <el-table-column label="套餐" width="140">
            <template #default="{ row }">{{ row.plan?.name || row.planId }}</template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.status === 'active' ? 'success' : row.status === 'trial' ? 'warning' : 'info'">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="开始时间" width="160">
            <template #default="{ row }">{{ row.startDate ? new Date(row.startDate).toLocaleDateString('zh-CN') : '-' }}</template>
          </el-table-column>
          <el-table-column label="结束时间" width="160">
            <template #default="{ row }">{{ row.endDate ? new Date(row.endDate).toLocaleDateString('zh-CN') : '永久' }}</template>
          </el-table-column>
          <el-table-column prop="autoRenew" label="自动续费" width="90" align="center">
            <template #default="{ row }">{{ row.autoRenew ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column prop="paymentMethod" label="支付方式" width="100" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="cancelSubscription(row)">取消</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-wrap" v-if="subTotal > subPageSize">
          <el-pagination layout="total, prev, pager, next" :total="subTotal" :page-size="subPageSize" v-model:current-page="subPage" @current-change="loadSubscriptions" />
        </div>
      </el-tab-pane>

      <!-- 收入概览 Tab -->
      <el-tab-pane label="收入概览" name="revenue">
        <div class="stat-cards">
          <div class="stat-card primary">
            <div class="stat-value">¥{{ stats.mrr || 0 }}</div>
            <div class="stat-label">月收入 (MRR)</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">¥{{ stats.totalRevenue || 0 }}</div>
            <div class="stat-label">总收入</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.paidUsers || 0 }}</div>
            <div class="stat-label">付费用户</div>
          </div>
          <div class="stat-card info">
            <div class="stat-value">¥{{ stats.arpu || 0 }}</div>
            <div class="stat-label">ARPU</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 套餐编辑对话框 -->
    <el-dialog v-model="planDialog.visible" :title="planDialog.isEdit ? '编辑套餐' : '新建套餐'" width="560px">
      <el-form :model="planDialog.form" label-width="100px">
        <el-form-item label="套餐名称" required>
          <el-input v-model="planDialog.form.name" placeholder="如：专业版" />
        </el-form-item>
        <el-form-item label="套餐代码" required>
          <el-input v-model="planDialog.form.code" placeholder="如：pro" :disabled="planDialog.isEdit" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="planDialog.form.category" style="width:100%">
            <el-option label="个人版" value="personal" />
            <el-option label="团队版" value="team" />
            <el-option label="企业版" value="enterprise" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="月价(元)">
              <el-input-number v-model="planDialog.form.monthlyPrice" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年价(元)">
              <el-input-number v-model="planDialog.form.yearlyPrice" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="月积分">
              <el-input-number v-model="planDialog.form.creditsPerMonth" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="试用天数">
              <el-input-number v-model="planDialog.form.trialDays" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="最大账号数">
              <el-input-number v-model="planDialog.form.maxAccounts" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大客户数">
              <el-input-number v-model="planDialog.form.maxCustomers" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="planDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="planDialog.loading" @click="savePlan">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配订阅对话框 -->
    <el-dialog v-model="assignDialog.visible" title="分配订阅" width="480px">
      <el-form :model="assignDialog.form" label-width="100px">
        <el-form-item label="用户ID" required>
          <el-input-number v-model="assignDialog.form.userId" :min="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="选择套餐" required>
          <el-select v-model="assignDialog.form.planId" placeholder="请选择套餐" style="width:100%">
            <el-option v-for="p in plans" :key="p.id" :label="p.name + ' (' + p.code + ')' + (p.monthlyPrice > 0 ? ' ¥' + p.monthlyPrice + '/月' : ' 免费')" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="assignDialog.form.status" style="width:100%">
            <el-option label="活跃" value="active" />
            <el-option label="试用" value="trial" />
          </el-select>
        </el-form-item>
        <el-form-item label="付费金额">
          <el-input-number v-model="assignDialog.form.pricePaid" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="assignDialog.form.reason" placeholder="分配原因（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="success" :loading="assignDialog.loading" @click="doAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api.js';

const currentTab = ref('subscriptions');
const plansLoading = ref(false);
const subsLoading = ref(false);
const plans = ref([]);
const planCategory = ref('all');
const subscriptions = ref([]);
const subTotal = ref(0);
const subPage = ref(1);
const subPageSize = 20;
const subFilter = reactive({ status: '' });
const stats = ref({});

// 套餐编辑对话框
const planDialog = reactive({
  visible: false,
  isEdit: false,
  loading: false,
  editId: null,
  form: {
    name: '', code: '', category: 'personal',
    monthlyPrice: 0, yearlyPrice: 0, creditsPerMonth: 0,
    trialDays: 0, maxAccounts: 0, maxCustomers: 0
  }
});

// 分配订阅对话框
const assignDialog = reactive({
  visible: false,
  loading: false,
  form: { userId: 1, planId: null, status: 'active', pricePaid: 0, reason: '' }
});

// 分类映射
const categoryMap = { free: 'personal', basic: 'personal', starter: 'personal', pro: 'team', team: 'team', business: 'enterprise', enterprise: 'enterprise' };
function getCategory(row) {
  if (row.category) return row.category;
  return categoryMap[row.code?.toLowerCase()] || 'personal';
}
function getCategoryLabel(row) {
  const map = { personal: '个人版', team: '团队版', enterprise: '企业版' };
  return map[getCategory(row)] || '个人版';
}
function getCategoryTag(row) {
  const map = { personal: '', team: 'warning', enterprise: 'danger' };
  return map[getCategory(row)] || '';
}
function statusLabel(s) {
  const map = { active: '活跃', expired: '已过期', cancelled: '已取消', trial: '试用', discontinued: '已下架' };
  return map[s] || s;
}

const filteredPlans = computed(() => {
  if (planCategory.value === 'all') return plans.value;
  return plans.value.filter(p => getCategory(p) === planCategory.value);
});

function filterPlans() { /* computed handles filtering */ }

async function loadPlans() {
  plansLoading.value = true;
  try {
    const res = await api.get('/admin/subscriptions/plans');
    const d = res.data?.data || res.data || [];
    plans.value = Array.isArray(d) ? d : [];
  } catch (e) { console.warn('loadPlans error:', e); }
  finally { plansLoading.value = false; }
}

async function loadSubscriptions() {
  subsLoading.value = true;
  try {
    const params = { page: subPage.value, pageSize: subPageSize };
    if (subFilter.status) params.status = subFilter.status;
    const res = await api.get('/admin/subscriptions', { params });
    const d = res.data;
    subscriptions.value = d?.data || d || [];
    subTotal.value = d?.total || 0;
  } catch (e) { console.warn('loadSubs error:', e); }
  finally { subsLoading.value = false; }
}

async function loadStats() {
  try {
    const res = await api.get('/admin/dashboard/stats');
    const d = res.data?.data || res.data || {};
    stats.value = d;
  } catch (e) { console.warn('loadStats error:', e); }
}

function showPlanDialog(row) {
  if (row) {
    planDialog.isEdit = true;
    planDialog.editId = row.id;
    planDialog.form = {
      name: row.name, code: row.code, category: getCategory(row),
      monthlyPrice: row.monthlyPrice || 0, yearlyPrice: row.yearlyPrice || 0,
      creditsPerMonth: row.creditsPerMonth || 0, trialDays: row.trialDays || 0,
      maxAccounts: row.maxAccounts || 0, maxCustomers: row.maxCustomers || 0
    };
  } else {
    planDialog.isEdit = false;
    planDialog.editId = null;
    planDialog.form = { name: '', code: '', category: 'personal', monthlyPrice: 0, yearlyPrice: 0, creditsPerMonth: 0, trialDays: 0, maxAccounts: 0, maxCustomers: 0 };
  }
  planDialog.visible = true;
}

function showAssignDialog() {
  assignDialog.form = { userId: 1, planId: plans.value.length > 0 ? plans.value[0].id : null, status: 'active', pricePaid: 0, reason: '' };
  assignDialog.visible = true;
}

async function doAssign() {
  if (!assignDialog.form.planId) { ElMessage.warning('请选择套餐'); return; }
  assignDialog.loading = true;
  try {
    await api.post('/admin/subscriptions', {
      userId: assignDialog.form.userId,
      planId: assignDialog.form.planId,
      status: assignDialog.form.status,
      pricePaid: assignDialog.form.pricePaid || null,
      reason: assignDialog.form.reason || '管理员分配订阅'
    });
    ElMessage.success('订阅分配成功');
    assignDialog.visible = false;
    loadSubscriptions();
    loadStats();
  } catch (e) { ElMessage.error(e.response?.data?.error || '分配失败'); }
  finally { assignDialog.loading = false; }
}

async function cancelSubscription(row) {
  try {
    await ElMessageBox.confirm(`确定要取消用户 ${row.userId} 的订阅吗？`, '确认取消', { type: 'warning' });
    await api.put('/admin/subscriptions/' + row.id, { status: 'cancelled', reason: '管理员手动取消' });
    ElMessage.success('订阅已取消');
    loadSubscriptions();
    loadStats();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.error || '操作失败');
  }
}

async function savePlan() {
  if (!planDialog.form.name || !planDialog.form.code) {
    ElMessage.warning('请填写套餐名称和代码');
    return;
  }
  planDialog.loading = true;
  try {
    if (planDialog.isEdit) {
      await api.put('/admin/subscriptions/plans/' + planDialog.editId, planDialog.form);
      ElMessage.success('套餐已更新');
    } else {
      await api.post('/admin/subscriptions/plans', planDialog.form);
      ElMessage.success('套餐已创建');
    }
    planDialog.visible = false;
    loadPlans();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '操作失败');
  } finally {
    planDialog.loading = false;
  }
}

async function deletePlan(row) {
  try {
    await ElMessageBox.confirm(`确定要下架套餐「${row.name}」吗？`, '确认下架', { type: 'warning' });
    await api.delete('/admin/subscriptions/plans/' + row.id);
    ElMessage.success('套餐已下架');
    loadPlans();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.error || '操作失败');
  }
}

onMounted(() => { loadPlans(); loadSubscriptions(); loadStats(); });
</script>

<style scoped>
.admin-page { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 20px; }
.tab-filter { margin-bottom: 16px; }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--bg-card, #fff); border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid #409eff; }
.stat-card.success { border-left-color: #67c23a; }
.stat-card.info { border-left-color: #909399; }
.stat-card.primary { border-left-color: #409eff; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; margin-bottom: 6px; }
.stat-label { font-size: 13px; color: #909399; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
