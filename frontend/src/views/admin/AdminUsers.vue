<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>用户管理</h2>
      <div class="header-actions">
        <el-input v-model="keyword" placeholder="搜索用户名/姓名" clearable style="width:220px" @keyup.enter="loadUsers" @clear="loadUsers">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="loadUsers">搜索</el-button>
        <el-button type="success" @click="openCreateUser">新增用户</el-button>
      </div>
    </div>

    <el-table :data="users" stripe style="width:100%" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="username" label="用户名" width="140" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="130">
        <template #default="{ row }">{{ row.phone || '-' }}</template>
      </el-table-column>
      <el-table-column prop="role" label="角色" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.role === 'banned' ? 'danger' : (row.role === 'ADMIN' ? 'danger' : 'info')">{{ row.role === 'banned' ? '已停用' : row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="订阅" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.subscription" size="small" type="success">{{ row.subscription.plan?.name || '已订阅' }}</el-tag>
          <el-tag v-else size="small" type="info">无</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="accountCount" label="账号数" width="90" align="center" />
      <el-table-column prop="contactCount" label="联系人" width="90" align="center" />
      <el-table-column prop="messageCount" label="消息数" width="90" align="center" />
      <el-table-column label="注册时间" width="160">
        <template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleDateString('zh-CN') : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-dropdown trigger="click" @command="(cmd) => handleCommand(cmd, row)">
            <el-button size="small" type="primary">操作 </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="detail">详情</el-dropdown-item>
                <el-dropdown-item command="assign">分配套餐</el-dropdown-item>
                <el-dropdown-item command="recharge">充值积分</el-dropdown-item>
                <el-dropdown-item command="deduct">扣减积分</el-dropdown-item>
                <el-dropdown-item command="reset">重置密码</el-dropdown-item>
                <el-dropdown-item v-if="row.role !== 'banned'" command="ban" divided>停用账号</el-dropdown-item>
                <el-dropdown-item v-else command="unban">解封账号</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap" v-if="total > pageSize">
      <el-pagination layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadUsers" />
    </div>

    <!-- 用户详情对话框 -->
    <el-dialog v-model="detailVisible" title="用户详情" width="500px">
      <el-descriptions :column="1" border v-if="currentUser">
        <el-descriptions-item label="ID">{{ currentUser.id }}</el-descriptions-item>
        <el-descriptions-item label="用户名">{{ currentUser.username }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ currentUser.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="角色"><el-tag size="small" :type="currentUser.role === 'ADMIN' ? 'danger' : 'info'">{{ currentUser.role }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="手机号">
          <div style="display:flex;gap:8px;align-items:center">
            <el-input v-model="phoneDraft" placeholder="绑定手机号（与社区打通）" size="small" style="width:210px" maxlength="11" />
            <el-button size="small" type="primary" :loading="savingPhone" @click="savePhone">保存</el-button>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">当前：{{ currentUser.phone || '未绑定' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="账号数">{{ currentUser.accountCount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="联系人数">{{ currentUser.contactCount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="消息数">{{ currentUser.messageCount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleString('zh-CN') : '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 分配套餐对话框 -->
    <el-dialog v-model="assignVisible" title="分配套餐" width="400px">
      <el-form v-if="currentUser" label-width="80px">
        <el-form-item label="用户名">{{ currentUser.username }}</el-form-item>
        <el-form-item label="选择套餐">
          <el-select v-model="assignPlanId" placeholder="请选择套餐" style="width:100%">
            <el-option v-for="plan in plans" :key="plan.id" :label="plan.name + ' (' + (plan.price === 0 ? '免费' : '$' + plan.price) + ')'" :value="plan.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="assignStatus" style="width:100%">
            <el-option label="活跃" value="active" />
            <el-option label="试用" value="trial" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="assignNote" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button type="success" @click="doAssignSubscription">确认分配</el-button>
      </template>
    </el-dialog>

    <!-- 充值积分对话框 -->
    <el-dialog v-model="rechargeVisible" title="充值积分" width="400px">
      <el-form v-if="currentUser" label-width="80px">
        <el-form-item label="用户名">{{ currentUser.username }}</el-form-item>
        <el-form-item label="充值数量"><el-input-number v-model="rechargeAmount" :min="1" :max="100000" :step="10" /></el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="rechargeMethod" style="width:100%">
            <el-option label="线下转账" value="bank_transfer" />
            <el-option label="系统赠送" value="system_gift" />
            <el-option label="测试充值" value="test" />
          </el-select>
        </el-form-item>
        <el-form-item label="充值说明"><el-input v-model="rechargeReason" type="textarea" :rows="2" placeholder="请输入充值说明" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeVisible = false">取消</el-button>
        <el-button type="primary" @click="doRechargeCredit">确认充值</el-button>
      </template>
    </el-dialog>

    <!-- 扣减积分对话框 -->
    <el-dialog v-model="deductVisible" title="扣减积分" width="400px">
      <el-form v-if="currentUser" label-width="80px">
        <el-form-item label="用户名">{{ currentUser.username }}</el-form-item>
        <el-form-item label="扣减数量"><el-input-number v-model="deductAmount" :min="1" :max="100000" :step="10" /></el-form-item>
        <el-form-item label="扣减原因"><el-input v-model="deductReason" type="textarea" :rows="2" placeholder="请输入扣减原因" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deductVisible = false">取消</el-button>
        <el-button type="warning" @click="doDeductCredit">确认扣减</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="400px">
      <el-form v-if="currentUser" label-width="80px">
        <el-form-item label="用户名">{{ currentUser.username }}</el-form-item>
        <el-form-item label="新密码"><el-input v-model="resetPassword" placeholder="请输入新密码" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="danger" @click="doResetPassword">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 新增用户对话框 -->
    <el-dialog v-model="createVisible" title="新增用户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="createForm.username" placeholder="登录用户名" maxlength="24" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="createForm.name" placeholder="可选" maxlength="24" />
        </el-form-item>
        <el-form-item label="初始密码" required>
          <el-input v-model="createForm.password" placeholder="至少8位，含大小写字母和数字" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" style="width:100%">
            <el-option label="销售 sales" value="sales" />
            <el-option label="经理 manager" value="manager" />
            <el-option label="管理员 admin" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creatingUser" @click="doCreateUser">确认创建</el-button>
      </template>
    </el-dialog>

    <!-- 停用/解封确认对话框 -->
    <el-dialog v-model="banVisible" :title="currentUser && currentUser.role === 'banned' ? '解封账号' : '停用账号'" width="420px">
      <el-form v-if="currentUser" label-width="80px">
        <el-form-item label="用户名">{{ currentUser.username }}</el-form-item>
        <el-form-item label="原因" :required="currentUser && currentUser.role !== 'banned'">
          <el-input v-model="banReason" type="textarea" :rows="2" :placeholder="currentUser && currentUser.role === 'banned' ? '解封原因（可选）' : '停用原因（必填，会写入审计）'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="banVisible = false">取消</el-button>
        <el-button :type="currentUser && currentUser.role === 'banned' ? 'success' : 'danger'" :loading="banning" @click="doToggleBan">
          {{ currentUser && currentUser.role === 'banned' ? '确认解封' : '确认停用' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import api from '../../utils/api.js'

const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const users = ref([])
const loading = ref(false)
const plans = ref([])

const currentUser = ref(null)
const detailVisible = ref(false)
const phoneDraft = ref('')
const savingPhone = ref(false)
const assignVisible = ref(false)
const rechargeVisible = ref(false)
const deductVisible = ref(false)
const resetVisible = ref(false)

const assignPlanId = ref(null)
const assignStatus = ref('active')
const assignNote = ref('')
const rechargeAmount = ref(10)
const rechargeMethod = ref('test')
const rechargeReason = ref('')
const deductAmount = ref(10)
const deductReason = ref('')
const resetPassword = ref('')

const createVisible = ref(false)
const creatingUser = ref(false)
const createForm = ref({ username: '', name: '', password: '', role: 'sales' })
const banVisible = ref(false)
const banning = ref(false)
const banReason = ref('')

onMounted(() => { loadUsers(); loadPlans() })

async function loadUsers() {
  loading.value = true
  try {
    const res = await api.get('/admin/users', { params: { keyword: keyword.value, page: page.value, pageSize: pageSize.value } })
    const data = res.data.data || []
    users.value = Array.isArray(data) ? data : []
    total.value = res.data.total || users.value.length
  } catch (e) { ElMessage.error('加载用户失败') }
  loading.value = false
}

async function loadPlans() {
  try {
    const res = await api.get('/admin/subscription-plans')
    plans.value = res.data.data || []
  } catch (e) { plans.value = [] }
}

function viewDetail(row) { currentUser.value = row; phoneDraft.value = row.phone || ''; detailVisible.value = true }

async function savePhone() {
  if (!currentUser.value) return
  const p = (phoneDraft.value || '').trim()
  if (p && !/^1[3-9]\d{9}$/.test(p)) { ElMessage.warning('请输入正确的手机号'); return }
  savingPhone.value = true
  try {
    await api.put(`/admin/users/${currentUser.value.id}`, { phone: p || null, reason: '绑定手机号（社区账号打通）' })
    ElMessage.success('手机号保存成功')
    currentUser.value.phone = p || null
    loadUsers()
  } catch (e) { ElMessage.error('保存失败: ' + (e.response?.data?.error || e.message)) }
  savingPhone.value = false
}
function openAssignSubscription(row) { currentUser.value = row; assignPlanId.value = null; assignStatus.value = 'active'; assignNote.value = ''; assignVisible.value = true }
function openRechargeCredit(row) { currentUser.value = row; rechargeAmount.value = 10; rechargeMethod.value = 'test'; rechargeReason.value = ''; rechargeVisible.value = true }
function openDeductCredit(row) { currentUser.value = row; deductAmount.value = 10; deductReason.value = ''; deductVisible.value = true }
function openResetPassword(row) { currentUser.value = row; resetPassword.value = ''; resetVisible.value = true }

function handleCommand(cmd, row) {
  currentUser.value = row
  if (cmd === 'detail') viewDetail(row)
  else if (cmd === 'assign') openAssignSubscription(row)
  else if (cmd === 'recharge') openRechargeCredit(row)
  else if (cmd === 'deduct') openDeductCredit(row)
  else if (cmd === 'reset') openResetPassword(row)
  else if (cmd === 'ban') openBan(row)
  else if (cmd === 'unban') openBan(row)
}

function openCreateUser() {
  createForm.value = { username: '', name: '', password: '', role: 'sales' }
  createVisible.value = true
}

async function doCreateUser() {
  const f = createForm.value
  if (!f.username) { ElMessage.warning('请输入用户名'); return }
  if (!f.password || f.password.length < 8) { ElMessage.warning('密码至少8位'); return }
  creatingUser.value = true
  try {
    await api.post('/auth/register', { username: f.username, password: f.password, name: f.name || f.username, role: f.role })
    ElMessage.success('用户创建成功')
    createVisible.value = false
    loadUsers()
  } catch (e) { ElMessage.error('创建失败: ' + (e.response?.data?.error || e.message)) }
  creatingUser.value = false
}

function openBan(row) {
  currentUser.value = row
  banReason.value = ''
  banVisible.value = true
}

async function doToggleBan() {
  if (!currentUser.value) return
  const isBan = currentUser.value.role !== 'banned'
  if (isBan && !banReason.value) { ElMessage.warning('请输入停用原因'); return }
  banning.value = true
  try {
    const url = isBan ? `/admin/users/${currentUser.value.id}/ban` : `/admin/users/${currentUser.value.id}/unban`
    await api.post(url, { reason: banReason.value || (isBan ? '停用账号' : '解封账号') })
    ElMessage.success(isBan ? '账号已停用' : '账号已解封')
    banVisible.value = false
    loadUsers()
  } catch (e) { ElMessage.error((isBan ? '停用' : '解封') + '失败: ' + (e.response?.data?.error || e.message)) }
  banning.value = false
}

async function doAssignSubscription() {
  if (!assignPlanId.value) { ElMessage.warning('请选择套餐'); return }
  try {
    await api.post('/admin/subscriptions/assign', { userId: currentUser.value.id, planId: assignPlanId.value, status: assignStatus.value, note: assignNote.value })
    ElMessage.success('套餐分配成功')
    assignVisible.value = false
    loadUsers()
  } catch (e) { ElMessage.error('分配失败: ' + (e.response?.data?.error || e.message)) }
}

async function doRechargeCredit() {
  if (!rechargeAmount.value || rechargeAmount.value <= 0) { ElMessage.warning('请输入有效充值数量'); return }
  try {
    await api.post('/admin/credits/recharge', { userId: currentUser.value.id, amount: rechargeAmount.value, paymentMethod: rechargeMethod.value, reason: rechargeReason.value })
    ElMessage.success('充值成功')
    rechargeVisible.value = false
    loadUsers()
  } catch (e) { ElMessage.error('充值失败: ' + (e.response?.data?.error || e.message)) }
}

async function doDeductCredit() {
  if (!deductAmount.value || deductAmount.value <= 0) { ElMessage.warning('请输入有效扣减数量'); return }
  try {
    await api.post('/admin/credits/deduct', { userId: currentUser.value.id, amount: deductAmount.value, reason: deductReason.value })
    ElMessage.success('扣减成功')
    deductVisible.value = false
    loadUsers()
  } catch (e) { ElMessage.error('扣减失败: ' + (e.response?.data?.error || e.message)) }
}

async function doResetPassword() {
  if (!resetPassword.value || resetPassword.value.length < 6) { ElMessage.warning('密码至少6位'); return }
  try {
    await ElMessageBox.confirm('确认重置 ' + currentUser.value.username + ' 的密码？', '确认', { type: 'warning' })
    await api.post('/admin/users/reset-password', { userId: currentUser.value.id, newPassword: resetPassword.value })
    ElMessage.success('密码重置成功')
    resetVisible.value = false
  } catch (e) { if (e !== 'cancel') ElMessage.error('重置失败') }
}
</script>
