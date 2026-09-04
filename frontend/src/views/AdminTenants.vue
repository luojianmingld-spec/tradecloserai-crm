<template>
  <div class="admin-tenants">
    <div class="page-header">
      <h2 class="page-title">租户管理</h2>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        新建租户
      </el-button>
    </div>

    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="租户名称">
          <el-input v-model="searchForm.keyword" placeholder="请输入租户名称或代码" clearable style="width: 240px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="正常" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchTenants">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 租户表格 -->
    <el-card shadow="never" style="margin-top: 16px;">
      <el-table :data="tenantList" v-loading="loading" style="width: 100%" border stripe>
        <el-table-column prop="name" label="租户名称" min-width="140" />
        <el-table-column prop="code" label="租户代码" width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="plan" label="套餐" width="120">
          <template #default="{ row }">
            <el-tag type="warning" size="small">{{ row.plan || '免费版' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="balance" label="余额" width="120">
          <template #default="{ row }">
            ¥{{ row.balance != null ? row.balance.toFixed(2) : '0.00' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 新建/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑租户' : '新建租户'"
      width="520px"
      @close="resetForm"
    >
      <el-form :model="tenantForm" :rules="formRules" ref="tenantFormRef" label-width="100px">
        <el-form-item label="租户名称" prop="name">
          <el-input v-model="tenantForm.name" placeholder="请输入租户名称" />
        </el-form-item>
        <el-form-item label="租户代码" prop="code">
          <el-input v-model="tenantForm.code" placeholder="请输入租户代码（英文）" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="套餐" prop="plan">
          <el-select v-model="tenantForm.plan" placeholder="请选择套餐" style="width: 100%">
            <el-option label="免费版" value="free" />
            <el-option label="基础版" value="basic" />
            <el-option label="专业版" value="pro" />
            <el-option label="企业版" value="enterprise" />
          </el-select>
        </el-form-item>
        <el-form-item label="余额" prop="balance">
          <el-input-number v-model="tenantForm.balance" :min="0" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="tenantForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import api from "../utils/api.js";

const loading = ref(false);
const submitting = ref(false);
const tenantList = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

const searchForm = reactive({
  keyword: "",
  status: "",
});

const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const tenantFormRef = ref(null);

const tenantForm = reactive({
  name: "",
  code: "",
  plan: "free",
  balance: 0,
  status: "active",
});

const formRules = {
  name: [{ required: true, message: "请输入租户名称", trigger: "blur" }],
  code: [{ required: true, message: "请输入租户代码", trigger: "blur" }],
  plan: [{ required: true, message: "请选择套餐", trigger: "change" }],
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchTenants() {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...searchForm,
    };
    const { data } = await api.get("/admin/tenants", { params });
    tenantList.value = data.list || data.tenants || data || [];
    total.value = data.total || tenantList.value.length;
  } catch (e) {
    console.warn("获取租户列表失败:", e.message);
    tenantList.value = [];
    total.value = 0;
    ElMessage.warning("租户管理API暂未实现，展示空列表");
  } finally {
    loading.value = false;
  }
}

function resetSearch() {
  searchForm.keyword = "";
  searchForm.status = "";
  currentPage.value = 1;
  fetchTenants();
}

function handlePageChange(page) {
  currentPage.value = page;
  fetchTenants();
}

function handleCreate() {
  isEdit.value = false;
  editId.value = null;
  resetFormData();
  dialogVisible.value = true;
}

function handleEdit(row) {
  isEdit.value = true;
  editId.value = row.id;
  tenantForm.name = row.name;
  tenantForm.code = row.code;
  tenantForm.plan = row.plan || "free";
  tenantForm.balance = row.balance || 0;
  tenantForm.status = row.status || "active";
  dialogVisible.value = true;
}

function resetFormData() {
  tenantForm.name = "";
  tenantForm.code = "";
  tenantForm.plan = "free";
  tenantForm.balance = 0;
  tenantForm.status = "active";
}

function resetForm() {
  if (tenantFormRef.value) {
    tenantFormRef.value.resetFields();
  }
  resetFormData();
}

async function handleSubmit() {
  if (!tenantFormRef.value) return;
  try {
    await tenantFormRef.value.validate();
  } catch (e) {
    return;
  }

  submitting.value = true;
  try {
    if (isEdit.value) {
      await api.put(`/admin/tenants/${editId.value}`, tenantForm);
      ElMessage.success("租户更新成功");
    } else {
      await api.post("/admin/tenants", tenantForm);
      ElMessage.success("租户创建成功");
    }
    dialogVisible.value = false;
    fetchTenants();
  } catch (e) {
    ElMessage.error(e.response?.data?.message || "操作失败");
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除租户「${row.name}」吗？此操作不可恢复。`,
      "删除确认",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );
    await api.delete(`/admin/tenants/${row.id}`);
    ElMessage.success("删除成功");
    fetchTenants();
  } catch (e) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.message || "删除失败");
    }
  }
}

onMounted(() => {
  fetchTenants();
});
</script>

<style scoped>
.admin-tenants {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.search-card {
  margin-bottom: 16px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
