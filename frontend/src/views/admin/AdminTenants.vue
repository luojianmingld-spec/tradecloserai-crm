<template>
  <div class="admin-tenants">
    <div class="page-header">
      <h2>租户管理</h2>
      <el-button type="primary" @click="showCreateDialog">创建租户</el-button>
    </div>
    
    <div class="filter-bar">
      <el-input v-model="searchKeyword" placeholder="搜索租户名称/代码" clearable style="width: 240px" @change="loadTenants" />
      <el-select v-model="statusFilter" placeholder="状态" clearable @change="loadTenants">
        <el-option label="全部" value="" />
        <el-option label="活跃" value="active" />
        <el-option label="试用" value="trial" />
        <el-option label="停用" value="suspended" />
      </el-select>
    </div>

    <el-table :data="tenants" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="租户名称" min-width="150" />
      <el-table-column prop="code" label="租户代码" width="120" />
      <el-table-column prop="plan" label="套餐" width="100">
        <template #default="{ row }">
          <el-tag :type="getPlanType(row.plan)">{{ row.plan }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="balance" label="余额" width="100">
        <template #default="{ row }">¥{{ row.balance?.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="userCount" label="用户数" width="80" />
      <el-table-column prop="createdAt" label="创建时间" width="160">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="editTenant(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteTenant(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" @current-change="loadTenants" />

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑租户' : '创建租户'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="租户名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="租户代码" required>
          <el-input v-model="form.code" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="套餐">
          <el-select v-model="form.plan">
            <el-option label="免费" value="free" />
            <el-option label="基础" value="basic" />
            <el-option label="专业" value="pro" />
            <el-option label="企业" value="enterprise" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="活跃" value="active" />
            <el-option label="试用" value="trial" />
            <el-option label="停用" value="suspended" />
          </el-select>
        </el-form-item>
        <el-form-item label="余额">
          <el-input-number v-model="form.balance" :min="0" :precision="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTenant" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api.js';

const loading = ref(false);
const saving = ref(false);
const tenants = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const searchKeyword = ref('');
const statusFilter = ref('');
const dialogVisible = ref(false);
const isEdit = ref(false);
const form = reactive({ id: null, name: '', code: '', plan: 'free', status: 'active', balance: 0 });

function getStatusType(s) { return { active: 'success', trial: 'warning', suspended: 'danger' }[s] || 'info'; }
function getStatusText(s) { return { active: '活跃', trial: '试用', suspended: '停用' }[s] || s; }
function getPlanType(p) { return { free: 'info', basic: '', pro: 'warning', enterprise: 'danger' }[p] || 'info'; }
function formatDate(d) { return new Date(d).toLocaleString('zh-CN'); }

async function loadTenants() {
  loading.value = true;
  try {
    const res = await api.get('/admin/tenants', { params: { page: currentPage.value, pageSize: pageSize.value, status: statusFilter.value || undefined, keyword: searchKeyword.value || undefined } });
    tenants.value = res.data?.data || res.data || [];
    total.value = res.data?.total || 0;
  } catch (e) { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
}

function showCreateDialog() {
  isEdit.value = false;
  Object.assign(form, { id: null, name: '', code: '', plan: 'free', status: 'active', balance: 0 });
  dialogVisible.value = true;
}

function editTenant(t) {
  isEdit.value = true;
  Object.assign(form, { id: t.id, name: t.name, code: t.code, plan: t.plan, status: t.status, balance: t.balance });
  dialogVisible.value = true;
}

async function saveTenant() {
  if (!form.name || !form.code) { ElMessage.warning('请填写必填项'); return; }
  saving.value = true;
  try {
    if (isEdit.value) { await api.put('/admin/tenants/' + form.id, form); ElMessage.success('更新成功'); }
    else { await api.post('/admin/tenants', form); ElMessage.success('创建成功'); }
    dialogVisible.value = false;
    loadTenants();
  } catch (e) { ElMessage.error(e.response?.data?.error || '操作失败'); }
  finally { saving.value = false; }
}

async function deleteTenant(t) {
  await ElMessageBox.confirm('确定删除租户「' + t.name + '」？', '确认', { type: 'warning' });
  try { await api.delete('/admin/tenants/' + t.id); ElMessage.success('删除成功'); loadTenants(); }
  catch (e) { ElMessage.error('删除失败'); }
}

onMounted(loadTenants);
</script>

<style scoped>
.admin-tenants { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
