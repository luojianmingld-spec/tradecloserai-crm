<template>
  <div class="admin-ai-models">
    <div class="page-header">
      <h2 class="page-title">AI模型管理</h2>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        添加模型
      </el-button>
    </div>

    <!-- 模型表格 -->
    <el-card shadow="never">
      <el-table :data="modelList" v-loading="loading" style="width: 100%" border stripe>
        <el-table-column prop="name" label="显示名称" min-width="160" />
        <el-table-column prop="provider" label="提供商" width="140">
          <template #default="{ row }">
            <el-tag size="small" :type="getProviderTagType(row.provider)">
              {{ row.provider }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model" label="模型名" width="200" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.active === false ? 'info' : 'success'" size="small">
              {{ row.active === false ? '禁用' : '启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="warning" size="small">默认</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="当前生效" width="90">
          <template #default="{ row }">
            <el-tag v-if="activeId === row.id" type="danger" size="small">生效中</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :disabled="activeId === row.id" @click="handleActivate(row)">设为当前</el-button>
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑模型' : '添加模型'"
      width="560px"
      @close="resetForm"
    >
      <el-form :model="modelForm" :rules="formRules" ref="modelFormRef" label-width="110px">
        <el-form-item label="提供商" prop="provider">
          <el-select v-model="modelForm.provider" placeholder="请选择提供商" style="width: 100%">
            <el-option label="OpenAI" value="openai" />
            <el-option label="Anthropic" value="anthropic" />
            <el-option label="Azure OpenAI" value="azure" />
            <el-option label="Google Gemini" value="google" />
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="Moonshot" value="moonshot" />
            <el-option label="智谱AI" value="zhipu" />
            <el-option label="通义千问" value="qwen" />
            <el-option label="火山方舟" value="volcano" />
            <el-option label="商汤" value="sensenova" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型名" prop="model">
          <el-input v-model="modelForm.model" placeholder="如：gpt-4o、claude-3-opus" />
        </el-form-item>
        <el-form-item label="显示名称" prop="name">
          <el-input v-model="modelForm.name" placeholder="给模型起个易记的名字" />
        </el-form-item>
        <el-form-item label="API Key" prop="apiKey">
          <el-input v-model="modelForm.apiKey" type="password" show-password :placeholder="isEdit ? '留空则不修改' : '请输入API Key'" />
        </el-form-item>
        <el-form-item label="Base URL" prop="baseUrl">
          <el-input v-model="modelForm.baseUrl" placeholder="可选，自定义API地址" />
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
const modelList = ref([]);
const activeId = ref("");

const dialogVisible = ref(false);
const isEdit = ref(false);
const editId = ref(null);
const modelFormRef = ref(null);

const modelForm = reactive({
  provider: "openai",
  model: "",
  name: "",
  apiKey: "",
  baseUrl: "",
});

const formRules = {
  provider: [{ required: true, message: "请选择提供商", trigger: "change" }],
  model: [{ required: true, message: "请输入模型名", trigger: "blur" }],
  name: [{ required: true, message: "请输入显示名称", trigger: "blur" }],
  apiKey: [{ required: true, message: "请输入API Key", trigger: "blur" }],
};

function getProviderTagType(provider) {
  const map = {
    openai: "", anthropic: "success", azure: "info", google: "warning",
    deepseek: "danger", moonshot: "", zhipu: "success", qwen: "warning",
    volcano: "warning", sensenova: "danger", other: "info",
  };
  return map[provider] || "info";
}

async function fetchModels() {
  loading.value = true;
  try {
    const { data } = await api.get("/settings/ai-providers");
    modelList.value = data.providers || [];
    activeId.value = data.activeId || "";
  } catch (e) {
    console.warn("获取AI模型列表失败:", e.message);
    modelList.value = [];
    activeId.value = "";
    ElMessage.warning("获取AI模型列表失败");
  } finally {
    loading.value = false;
  }
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
  modelForm.provider = row.provider || "openai";
  modelForm.model = row.model || "";
  modelForm.name = row.name || "";
  modelForm.apiKey = ""; // 编辑时留空表示不修改
  modelForm.baseUrl = row.baseUrl || "";
  dialogVisible.value = true;
}

function resetFormData() {
  modelForm.provider = "openai";
  modelForm.model = "";
  modelForm.name = "";
  modelForm.apiKey = "";
  modelForm.baseUrl = "";
}

function resetForm() {
  if (modelFormRef.value) {
    modelFormRef.value.resetFields();
  }
  resetFormData();
}

async function handleSubmit() {
  if (!modelFormRef.value) return;
  try {
    await modelFormRef.value.validate();
  } catch (e) {
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      provider: modelForm.provider,
      model: modelForm.model,
      name: modelForm.name,
      apiKey: modelForm.apiKey,
      baseUrl: modelForm.baseUrl,
    };
    if (isEdit.value) {
      await api.put(`/settings/ai-providers/${editId.value}`, payload);
      ElMessage.success("模型更新成功");
    } else {
      await api.post("/settings/ai-providers", payload);
      ElMessage.success("模型添加成功");
    }
    dialogVisible.value = false;
    fetchModels();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || "操作失败");
  } finally {
    submitting.value = false;
  }
}

async function handleActivate(row) {
  try {
    await api.post(`/settings/ai-providers/${row.id}/activate`);
    ElMessage.success(`已将「${row.name || row.model}」设为当前生效模型`);
    fetchModels();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || "设为当前失败");
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定要删除模型「${row.name || row.model}」吗？`,
      "删除确认",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    );
    await api.delete(`/settings/ai-providers/${row.id}`);
    ElMessage.success("删除成功");
    fetchModels();
  } catch (e) {
    if (e !== "cancel") {
      ElMessage.error(e.response?.data?.error || "删除失败");
    }
  }
}

onMounted(() => {
  fetchModels();
});
</script>

<style scoped>
.admin-ai-models {
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
</style>
