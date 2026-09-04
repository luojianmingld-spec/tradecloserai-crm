<template>
  <div class="admin-page">
    <h2>审计日志</h2>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <el-table :data="tableData" stripe style="width:100%">
        <el-table-column v-for="col in columns" :key="col.prop" :prop="col.prop" :label="col.label" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../../utils/api.js';

const loading = ref(true);
const tableData = ref([]);
const columns = ref([]);

async function loadData() {
  loading.value = true;
  try {
    const res = await api.get('/admin/audit-logs');
    const d = res.data?.data || res.data || [];
    if (Array.isArray(d)) {
      tableData.value = d;
    } else if (d.data && Array.isArray(d.data)) {
      tableData.value = d.data;
    } else {
      tableData.value = Array.isArray(d) ? d : [d];
    }
    if (tableData.value.length > 0) {
      columns.value = Object.keys(tableData.value[0]).filter(k => typeof tableData.value[0][k] !== 'object').slice(0, 8).map(k => ({ prop: k, label: k }));
    }
  } catch (e) {
    console.warn('审计日志 load error:', e);
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.admin-page h2 { margin: 0 0 20px; color: #303133; }
.loading { text-align: center; padding: 40px; color: #909399; }
</style>
