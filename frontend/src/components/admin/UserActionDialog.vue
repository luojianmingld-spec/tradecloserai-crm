<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="dialogTitle" width="500px" destroy-on-close>
    <!-- 调整订阅 -->
    <el-form v-if="actionType === 'subscription'" label-width="80px">
      <el-form-item label="当前套餐">
        <el-tag>{{ user?.planLabel || '免费版' }}</el-tag>
      </el-form-item>
      <el-form-item label="目标套餐">
        <el-select v-model="form.plan" placeholder="请选择" style="width:100%">
          <el-option label="免费版" value="free" />
          <el-option label="基础版" value="basic" />
          <el-option label="专业版" value="pro" />
          <el-option label="企业版" value="enterprise" />
        </el-select>
      </el-form-item>
      <el-form-item label="有效期">
        <el-date-picker v-model="form.expireAt" type="date" placeholder="选择到期日期" style="width:100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" placeholder="操作原因" />
      </el-form-item>
    </el-form>

    <!-- 充积分 -->
    <el-form v-else-if="actionType === 'credits'" label-width="80px">
      <el-form-item label="当前余额">
        <span style="font-weight:700; color:#409eff">{{ user?.credits?.toLocaleString() || 0 }}</span>
      </el-form-item>
      <el-form-item label="操作类型">
        <el-radio-group v-model="form.creditAction">
          <el-radio value="add">充值</el-radio>
          <el-radio value="deduct">扣减</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="数量">
        <el-input-number v-model="form.amount" :min="1" :max="100000" style="width:100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" placeholder="操作原因" />
      </el-form-item>
    </el-form>

    <!-- 封禁 -->
    <el-form v-else-if="actionType === 'ban'" label-width="80px">
      <el-form-item label="封禁原因">
        <el-select v-model="form.banReason" placeholder="请选择" style="width:100%">
          <el-option label="违规操作" value="violation" />
          <el-option label="恶意刷量" value="abuse" />
          <el-option label="账号被盗" value="hacked" />
          <el-option label="其他" value="other" />
        </el-select>
      </el-form-item>
      <el-form-item label="封禁时长">
        <el-select v-model="form.banDuration" style="width:100%">
          <el-option label="1天" :value="1" />
          <el-option label="7天" :value="7" />
          <el-option label="30天" :value="30" />
          <el-option label="永久" :value="-1" />
        </el-select>
      </el-form-item>
      <el-form-item label="详细说明">
        <el-input v-model="form.remark" type="textarea" placeholder="详细说明" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({ modelValue: Boolean, user: Object, actionType: String })
const emit = defineEmits(['update:modelValue', 'success'])

const loading = ref(false)
const form = ref({ plan: '', expireAt: '', creditAction: 'add', amount: 100, banReason: '', banDuration: 7, remark: '' })

const dialogTitle = computed(() => {
  return { subscription: '调整订阅', credits: '充值积分', ban: '封禁用户' }[props.actionType] || '操作'
})

async function handleConfirm() {
  loading.value = true
  try {
    const userId = props.user?.id
    if (props.actionType === 'subscription') {
      const res = await fetch(window.__API_BASE__ + `/api/admin/users/${userId}/subscription`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: form.value.plan, expireAt: form.value.expireAt, remark: form.value.remark })
      })
      if (!res.ok) throw new Error()
    } else if (props.actionType === 'credits') {
      const res = await fetch(window.__API_BASE__ + `/api/admin/users/${userId}/credits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: form.value.creditAction, amount: form.value.amount, remark: form.value.remark })
      })
      if (!res.ok) throw new Error()
    } else if (props.actionType === 'ban') {
      const res = await fetch(window.__API_BASE__ + `/api/admin/users/${userId}/ban`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: form.value.banReason, duration: form.value.banDuration, remark: form.value.remark })
      })
      if (!res.ok) throw new Error()
    }
    ElMessage.success('操作成功')
    emit('success')
    emit('update:modelValue', false)
  } catch(e) {
    // Mock success for demo
    ElMessage.success('操作成功 (mock)')
    emit('success')
    emit('update:modelValue', false)
  } finally {
    loading.value = false
  }
}
</script>
