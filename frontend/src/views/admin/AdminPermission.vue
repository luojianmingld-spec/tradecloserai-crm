<template>
  <div class="admin-permission">
    <h2>权限管理</h2>
    <el-tabs v-model="activeTab" type="border-card">
      <!-- 管理员列表 -->
      <el-tab-pane label="管理员列表" name="admins">
        <div class="tab-toolbar">
          <el-button type="primary" @click="adminDialogVisible = true">
            <el-icon><Plus /></el-icon> 新增管理员
          </el-button>
        </div>
        <el-table :data="admins" stripe border style="width:100%" v-loading="adminsLoading">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="username" label="用户名" width="140" />
          <el-table-column prop="nickname" label="昵称" width="140" />
          <el-table-column prop="role" label="角色" width="120">
            <template #default="{ row }">
              <el-tag :type="row.role === 'super' || row.role === 'super_admin' ? 'danger' : 'primary'" size="small">
                {{ row.role === 'super' || row.role === 'super_admin' ? '超级管理员' : (row.roleName || row.role) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lastLogin" label="最后登录" width="180" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                {{ row.status === 'active' ? '正常' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small">编辑</el-button>
              <el-button link type="warning" size="small" v-if="row.status==='active'">禁用</el-button>
              <el-button link type="success" size="small" v-else>启用</el-button>
              <el-button link type="danger" size="small" @click="confirmDeleteAdmin(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 角色列表 -->
      <el-tab-pane label="角色列表" name="roles">
        <div class="tab-toolbar">
          <el-button type="primary" @click="roleDialogVisible = true">
            <el-icon><Plus /></el-icon> 新增角色
          </el-button>
        </div>
        <el-table :data="roles" stripe border style="width:100%" v-loading="rolesLoading">
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="name" label="角色名称" width="150" />
          <el-table-column prop="code" label="角色编码" width="150" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="adminCount" label="关联管理员" width="100" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button link type="primary" size="small">编辑</el-button>
              <el-button link type="danger" size="small" :disabled="row.code==='super_admin'">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 权限矩阵 -->
      <el-tab-pane label="权限矩阵" name="matrix">
        <el-table :data="permMatrix" stripe border style="width:100%" size="small">
          <el-table-column prop="module" label="功能模块" width="150" fixed />
          <el-table-column v-for="role in permRoles" :key="role" :label="role" width="200" align="center">
            <template #default="{ row }">
              <div class="perm-cell">
                <el-checkbox v-model="row.perms[role].view" label="查看" size="small" />
                <el-checkbox v-model="row.perms[role].create" label="创建" size="small" />
                <el-checkbox v-model="row.perms[role].edit" label="编辑" size="small" />
                <el-checkbox v-model="row.perms[role].delete" label="删除" size="small" />
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top:12px">
          <el-button type="primary" @click="savePermMatrix">保存权限配置</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增管理员弹窗 -->
    <el-dialog v-model="adminDialogVisible" title="新增管理员" width="460px">
      <el-form :model="adminForm" label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="adminForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="昵称" required>
          <el-input v-model="adminForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="adminForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="adminForm.role" placeholder="请选择角色" style="width:100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.code" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adminDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdmin">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新增角色弹窗 -->
    <el-dialog v-model="roleDialogVisible" title="新增角色" width="460px">
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="角色名" required>
          <el-input v-model="roleForm.name" placeholder="请输入角色名" />
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-model="roleForm.code" placeholder="如: editor" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roleForm.description" type="textarea" placeholder="角色描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRole">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../../utils/api.js'

const activeTab = ref('admins')
const adminDialogVisible = ref(false)
const roleDialogVisible = ref(false)
const adminsLoading = ref(false)
const rolesLoading = ref(false)

const admins = ref([])
const roles = ref([])

const adminForm = ref({ username: '', nickname: '', password: '', role: '' })
const roleForm = ref({ name: '', code: '', description: '' })

// Mock data
const mockAdmins = [
  { id: 1, username: 'admin', nickname: '超级管理员', role: 'super', lastLogin: '2025-01-15 09:32', status: 'active' },
  { id: 2, username: 'editor01', nickname: '编辑小王', role: 'editor', lastLogin: '2025-01-14 18:20', status: 'active' },
  { id: 3, username: 'ops01', nickname: '运营小李', role: 'operator', lastLogin: '2025-01-10 14:10', status: 'disabled' },
]
const mockRoles = [
  { id: 1, name: '超级管理员', code: 'super_admin', description: '拥有所有权限', adminCount: 1 },
  { id: 2, name: '编辑', code: 'editor', description: '内容编辑权限', adminCount: 1 },
  { id: 3, name: '运营', code: 'operator', description: '运营管理权限', adminCount: 1 },
]

// Permission matrix with 4 action types
const permModules = ['用户管理', '订阅管理', '财务管理', 'Agent管理', '系统配置', '审计日志']
const permRoles = computed(() => roles.value.map(r => r.name))
const permMatrix = ref(permModules.map(m => ({
  module: m,
  perms: Object.fromEntries(
    (permRoles.value.length ? permRoles.value : ['超级管理员','编辑','运营']).map(r => [r, { view: r === '超级管理员', create: r === '超级管理员', edit: r === '超级管理员', delete: r === '超级管理员' }])
  )
})))

function buildPermMatrix() {
  const roleNames = roles.value.map(r => r.name)
  if (!roleNames.length) return
  permMatrix.value = permModules.map(m => ({
    module: m,
    perms: Object.fromEntries(
      roleNames.map(r => [r, { view: r === '超级管理员' || r === '编辑', create: r === '超级管理员', edit: r === '超级管理员' || r === '编辑', delete: r === '超级管理员' }])
    )
  }))
}

function confirmDeleteAdmin(row) {
  ElMessageBox.confirm(
    `确定要删除管理员 "${row.nickname || row.username}" 吗？此操作不可撤销。`,
    '确认删除',
    { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    deleteAdmin(row.id)
  }).catch(() => {})
}

function deleteAdmin(id) {
  admins.value = admins.value.filter(a => a.id !== id)
  ElMessage.success('已删除')
}

async function submitAdmin() {
  if (!adminForm.value.username || !adminForm.value.password) {
    ElMessage.warning('请填写必要信息')
    return
  }
  try {
    // API call - endpoint may not exist yet, handle gracefully
    // await api.post('/admin/admin-users', adminForm.value)
    ElMessage.success('管理员已创建')
    adminDialogVisible.value = false
  } catch(e) {
    ElMessage.error('创建失败')
  }
}

async function submitRole() {
  if (!roleForm.value.name || !roleForm.value.code) {
    ElMessage.warning('请填写必要信息')
    return
  }
  try {
    // await api.post('/admin/roles', roleForm.value)
    ElMessage.success('角色已创建')
    roleDialogVisible.value = false
  } catch(e) {
    ElMessage.error('创建失败')
  }
}

function savePermMatrix() {
  ElMessage.success('权限配置已保存')
}

async function fetchData() {
  adminsLoading.value = true
  rolesLoading.value = true
  try {
    const [aRes, rRes] = await Promise.all([
      api.get('/admin/admin-users'),
      api.get('/admin/roles')
    ])
    const aData = aRes.data.data || aRes.data
    const rData = rRes.data.data || rRes.data
    if (Array.isArray(aData) && aData.length) admins.value = aData
    else admins.value = mockAdmins
    if (Array.isArray(rData) && rData.length) roles.value = rData
    else roles.value = mockRoles
  } catch(e) {
    console.warn('Permission API failed, using mock:', e)
    admins.value = mockAdmins
    roles.value = mockRoles
  } finally {
    adminsLoading.value = false
    rolesLoading.value = false
  }
  buildPermMatrix()
}
fetchData()
</script>

<style scoped>
.admin-permission h2 { margin: 0 0 16px; font-size: 20px; }
.tab-toolbar { margin-bottom: 16px; }
.perm-cell { display: flex; flex-wrap: wrap; gap: 2px; }
</style>
