
<template>
  <div class="product-knowledge-page">
    <div class="page-actions">
      <el-button type="success" @click="showImportDialog">
        <el-icon><UploadFilled /></el-icon>
        智能导入
      </el-button>
      <el-button type="primary" @click="showCreateDialog" style="margin-left: 8px">
        <el-icon><Plus /></el-icon>
        新增产品
      </el-button>
    </div>

    <!-- 产品列表 -->
    <div class="product-list" v-loading="loading">
      <el-empty v-if="products.length === 0 && !loading" description="暂无产品，点击上方按钮添加">
        <div style="color: var(--text-secondary); font-size: 13px; max-width: 300px; text-align: center; line-height: 1.8;">
          💡 使用「智能导入」可自动从网址或产品目录册中提取产品信息
        </div>
      </el-empty>
      
      <div v-else>
        <div v-for="product in products" :key="product.id" class="product-card">
          <div class="card-header">
            <div class="product-name">
              <div class="cn-name">{{ product.productNameCn }}</div>
              <div class="en-name">{{ product.productNameEn }}</div>
            </div>
            <el-switch 
              v-model="product.isActive" 
              @change="toggleProductStatus(product)"
              size="small"
            />
          </div>
          
          <div class="product-info">
            <div class="info-item" v-if="product.pricingUnit">
              <span class="label">计价单位:</span>
              <span class="value">{{ product.pricingUnit }}</span>
            </div>
            <div class="info-item" v-if="product.basePrice">
              <span class="label">基础价格:</span>
              <span class="value">${{ product.basePrice }}/{{ product.pricingUnit }}</span>
            </div>
            <div class="info-item" v-if="product.moq">
              <span class="label">起订量:</span>
              <span class="value">{{ product.moq }}</span>
            </div>
            <div class="info-item" v-if="product.deliveryDays">
              <span class="label">交期:</span>
              <span class="value">{{ product.deliveryDays }}</span>
            </div>
            <div class="info-item">
              <span class="label">问题数:</span>
              <span class="value">{{ product.questions?.length || 0 }}</span>
            </div>
          </div>

          <div class="card-actions">
            <el-button type="success" link @click="previewProductDetail(product)">
              <el-icon><View /></el-icon>
              预览
            </el-button>
            <el-button type="primary" link @click="editProduct(product)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" link @click="deleteProduct(product)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 智能导入对话框 ===== -->
    <el-dialog 
      v-model="importDialogVisible" 
      title="🤖 智能导入产品" 
      width="900px"
      :close-on-click-modal="false"
      top="5vh"
    >
      <!-- 步骤1：输入来源 -->
      <div v-if="importStep === 1" class="import-step">
        <div class="import-tip-box">
          <div class="tip-title">📋 使用说明</div>
          <div class="tip-list">
            <div>• <b>网址导入</b>：输入公司官网或产品页面URL，系统自动抓取产品信息</div>
            <div>• <b>文件导入</b>：上传产品目录册（支持 PDF / TXT / CSV 格式）</div>
            <div>• <b>备注说明</b>：填写产品定位、目标市场等，AI 会据此优化提取效果</div>
            <div>• 💡 没有自己的网站？可以输入<b>同行/竞品</b>的产品页面网址作为参考</div>
          </div>
        </div>

        <el-tabs v-model="importTab" class="import-tabs">
          <el-tab-pane label="🔗 网址导入" name="url">
            <div class="import-input-group">
              <label class="input-label">产品页面网址</label>
              <el-input 
                v-model="importUrl" 
                placeholder="例如：https://www.example.com/products 或 https://www.yoursite.com/product-catalog"
                size="large"
                clearable
              />
              <div class="input-hint">支持产品列表页、单个产品详情页，系统会自动发现子页面</div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="📎 文件上传" name="file">
            <div class="import-input-group">
              <label class="input-label">上传产品目录</label>
              <el-upload
                ref="uploadRef"
                drag
                action=""
                :auto-upload="false"
                :limit="1"
                :on-change="handleFileChange"
                :on-remove="handleFileRemove"
                accept=".pdf,.txt,.csv,.doc,.docx,.xlsx,.xls"
              >
                <div class="upload-area">
                  <el-icon style="font-size: 40px; color: var(--text-secondary);"><UploadFilled /></el-icon>
                  <div class="upload-text">拖拽文件到这里，或<em>点击上传</em></div>
                  <div class="upload-hint">支持 PDF、TXT、CSV、Word、Excel 格式</div>
                </div>
              </el-upload>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div class="import-input-group" style="margin-top: 16px;">
          <label class="input-label">📝 备注说明 <span class="optional-tag">（选填）</span></label>
          <el-input
            v-model="importNote"
            type="textarea"
            :rows="4"
            placeholder="填写备注可帮助AI更精准地提取产品信息。例如：
• 我们是玻璃深加工企业，主营钢化玻璃、中空玻璃、夹层玻璃
• 目标市场是中东和东南亚，客户主要是建筑承包商
• 价格定位中端，MOQ 为 500 平方米
• 重点提取产品规格、认证信息和应用场景"
            maxlength="1000"
            show-word-limit
          />
        </div>

        <div class="import-actions">
          <el-button @click="importDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="startImport"
            :loading="importLoading"
            :disabled="!canStartImport"
          >
            🚀 开始AI识别
          </el-button>
        </div>
      </div>

      <!-- 步骤2：预览提取结果 -->
      <div v-if="importStep === 2" class="import-step">
        <div class="import-result-header">
          <div class="result-info">
            <el-icon style="color: #67c23a; font-size: 20px;"><CircleCheckFilled /></el-icon>
            <span>AI 识别完成！共提取 <b>{{ importedProducts.length }}</b> 个产品</span>
            <span v-if="importMeta" class="meta-info">
              (扫描 {{ importMeta.scannedPages || 1 }} 个页面)
            </span>
          </div>
          <el-button size="small" @click="importStep = 1">← 重新输入</el-button>
        </div>

        <div class="import-products-preview" v-loading="importLoading">
          <div v-for="(p, idx) in importedProducts" :key="idx" class="preview-product-card" :class="{ selected: p._selected !== false }">
            <div class="preview-card-header" @click="toggleProductSelection(idx)">
              <el-checkbox :model-value="p._selected !== false" @click.stop="toggleProductSelection(idx)" />
              <div class="preview-names">
                <span class="preview-cn">{{ p.productNameCn || '—' }}</span>
                <span class="preview-en">{{ p.productNameEn }}</span>
              </div>
              <el-tag v-if="p._selected !== false" type="success" size="small">已选</el-tag>
              <el-tag v-else type="info" size="small">不导入</el-tag>
            </div>
            <div class="preview-body" v-if="p._selected !== false">
              <div class="preview-desc" v-if="p.productDesc">{{ p.productDesc }}</div>
              <div class="preview-meta-row">
                <span v-if="p.pricingUnit">💰 {{ p.basePrice ? '$' + p.basePrice + '/' + p.pricingUnit : p.pricingUnit }}</span>
                <span v-if="p.moq">📦 MOQ: {{ p.moq }}</span>
                <span v-if="p.deliveryDays">🚚 {{ p.deliveryDays }}</span>
                <span v-if="p.questions?.length">❓ {{ p.questions.length }}个问题</span>
              </div>
            </div>
          </div>

          <el-empty v-if="importedProducts.length === 0" description="未识别到产品，请尝试换网址或补充备注说明" />
        </div>

        <div class="import-actions">
          <el-button @click="importStep = 1">返回修改</el-button>
          <el-button 
            type="primary" 
            @click="batchImport"
            :loading="batchLoading"
            :disabled="selectedProducts.length === 0"
          >
            ✅ 导入选中的 {{ selectedProducts.length }} 个产品
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 产品编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? '编辑产品' : '新增产品'" 
      width="800px"
      :close-on-click-modal="false"
    >
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="10">
          <el-col :span="11">
            <el-form-item label="产品中文名" prop="productNameCn">
              <el-input v-model="formData.productNameCn" placeholder="如：缠绕膜" />
            </el-form-item>
          </el-col>
          <el-col :span="11">
            <el-form-item label="产品英文名" prop="productNameEn">
              <el-input v-model="formData.productNameEn" placeholder="如：Stretch Film" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10" style="margin-top: 8px">
          <el-col :span="8">
            <el-form-item label="产品描述">
              <el-input v-model="formData.productDesc" type="textarea" :rows="2" placeholder="产品描述..." />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10">
          <el-col :span="11">
            <el-form-item label="计价单位">
              <el-input v-model="formData.pricingUnit" placeholder="如：kg、roll" />
            </el-form-item>
          </el-col>
          <el-col :span="11">
            <el-form-item label="基础价格">
              <div style="display:flex;align-items:center;gap:4px;">
                <span style="padding: 0 8px; color: var(--text-secondary); font-size: 14px; flex-shrink: 0">$</span>
                <el-input-number v-model="formData.basePrice" :min="0" :precision="2" style="width:100%" placeholder="0.00" />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="10" style="margin-top: 8px">
          <el-col :span="8">
            <el-form-item label="起订量">
              <el-input v-model="formData.moq" placeholder="如：1000" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交期">
              <el-input v-model="formData.deliveryDays" placeholder="如：15天" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="付款条件">
              <el-input v-model="formData.paymentTerms" placeholder="如：30%预付" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">问题清单</el-divider>
        <div style="margin-bottom:12px">
          <el-button size="small" @click="addQuestion(1)">+ 添加必问</el-button>
          <el-button size="small" @click="addQuestion(2)" style="margin-left:8px">+ 添加进阶</el-button>
        </div>
        <div v-if="formData.questions.filter(q => q.priority === 1).length > 0">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-primary)">必问问题</div>
          <div v-for="(q, idx) in formData.questions.filter(q => q.priority === 1)" :key="'q1-'+idx" class="question-edit-item">
            <el-row :gutter="10">
              <el-col :span="11">
                <el-input v-model="q.questionCn" placeholder="中文问题" size="small" />
              </el-col>
              <el-col :span="11">
                <el-input v-model="q.questionEn" placeholder="English question" size="small" />
              </el-col>
              <el-col :span="2">
                <el-button type="danger" link size="small" @click="removeQuestion(formData.questions.indexOf(q))">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-col>
            </el-row>
            <el-row :gutter="10" style="margin-top: 8px">
              <el-col :span="8">
                <el-select v-model="q.questionType" size="small" style="width:100%">
                  <el-option label="文本" value="text" />
                  <el-option label="数字" value="number" />
                  <el-option label="单选" value="single_choice" />
                  <el-option label="多选" value="multiple_choice" />
                </el-select>
              </el-col>
              <el-col :span="16" v-if="q.questionType === 'single_choice' || q.questionType === 'multiple_choice'">
                <el-input v-model="q.optionsText" placeholder="选项，用逗号分隔" size="small" />
              </el-col>
            </el-row>
          </div>
        </div>
        <el-empty v-else description="暂无必问问题" :image-size="60" />

        <div v-if="formData.questions.filter(q => q.priority === 2).length > 0" style="margin-top:16px">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-primary)">进阶问题</div>
          <div v-for="(q, idx) in formData.questions.filter(q => q.priority === 2)" :key="'q2-'+idx" class="question-edit-item">
            <el-row :gutter="10">
              <el-col :span="11">
                <el-input v-model="q.questionCn" placeholder="中文问题" size="small" />
              </el-col>
              <el-col :span="11">
                <el-input v-model="q.questionEn" placeholder="English question" size="small" />
              </el-col>
              <el-col :span="2">
                <el-button type="danger" link size="small" @click="removeQuestion(formData.questions.indexOf(q))">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-col>
            </el-row>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ isEdit ? '保存修改' : '创建产品' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog v-model="previewVisible" title="产品详情预览" width="700px">
      <div v-if="previewProduct" class="preview-content">
        <div class="preview-header">
          <h3>{{ previewProduct.productNameCn }}</h3>
          <span class="preview-en">{{ previewProduct.productNameEn }}</span>
        </div>
        <div class="preview-desc" v-if="previewProduct.productDesc">
          {{ previewProduct.productDesc }}
        </div>
        <el-divider />
        <div class="preview-pricing">
          <div class="pricing-item" v-if="previewProduct.pricingUnit">
            <span class="pricing-label">计价单位</span>
            <span class="pricing-value">{{ previewProduct.pricingUnit }}</span>
          </div>
          <div class="pricing-item" v-if="previewProduct.basePrice">
            <span class="pricing-label">基础价格</span>
            <span class="pricing-value">${{ previewProduct.basePrice }}/{{ previewProduct.pricingUnit }}</span>
          </div>
          <div class="pricing-item" v-if="previewProduct.moq">
            <span class="pricing-label">起订量</span>
            <span class="pricing-value">{{ previewProduct.moq }}</span>
          </div>
          <div class="pricing-item" v-if="previewProduct.deliveryDays">
            <span class="pricing-label">交期</span>
            <span class="pricing-value">{{ previewProduct.deliveryDays }}</span>
          </div>
          <div class="pricing-item" v-if="previewProduct.paymentTerms">
            <span class="pricing-label">付款条件</span>
            <span class="pricing-value">{{ previewProduct.paymentTerms }}</span>
          </div>
        </div>
        <el-divider content-position="left">问题清单</el-divider>
        <div class="preview-questions">
          <div v-for="(q, idx) in previewProduct.questions" :key="idx" class="question-item">
            <div class="question-header">
              <el-tag size="small" :type="q.priority === 1 ? 'danger' : 'warning'">
                {{ q.priority === 1 ? '必问' : '进阶' }}
              </el-tag>
              <el-tag size="small" type="info">{{ q.questionType === 'text' ? '文本' : q.questionType === 'number' ? '数字' : q.questionType === 'single_choice' ? '单选' : '多选' }}</el-tag>
            </div>
            <div class="question-cn">{{ q.questionCn }}</div>
            <div class="question-en">{{ q.questionEn }}</div>
            <div v-if="q.optionsJson" class="question-options">
              <el-tag v-for="(opt, oi) in parseOptions(q.optionsJson)" :key="oi" size="small" class="option-tag">{{ opt }}</el-tag>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, View, UploadFilled, CircleCheckFilled } from '@element-plus/icons-vue'
import api from '../utils/api.js'

const loading = ref(false)
const products = ref([])
const dialogVisible = ref(false)
const previewVisible = ref(false)
const previewProduct = ref(null)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref(null)
let tempIdCounter = 0

// ── 智能导入状态 ──
const importDialogVisible = ref(false)
const importStep = ref(1) // 1=输入, 2=预览结果
const importTab = ref('url')
const importUrl = ref('')
const importNote = ref('')
const importFile = ref(null)
const importLoading = ref(false)
const batchLoading = ref(false)
const importedProducts = ref([])
const importMeta = ref(null)
const uploadRef = ref(null)

const canStartImport = computed(() => {
  if (importTab.value === 'url') return !!importUrl.value.trim()
  return !!importFile.value
})

const selectedProducts = computed(() => {
  return importedProducts.value.filter(p => p._selected !== false)
})

const formData = reactive({
  id: null,
  productNameCn: '',
  productNameEn: '',
  productDesc: '',
  productImageUrl: '',
  pricingUnit: 'kg',
  basePrice: null,
  moq: null,
  deliveryDays: null,
  paymentTerms: '',
  isActive: true,
  questions: []
})

const rules = {
  productNameCn: [{ required: true, message: '请输入产品中文名', trigger: 'blur' }],
  productNameEn: [{ required: true, message: '请输入产品英文名', trigger: 'blur' }]
}

// ── 智能导入方法 ──
const showImportDialog = () => {
  importStep.value = 1
  importUrl.value = ''
  importNote.value = ''
  importFile.value = null
  importedProducts.value = []
  importMeta.value = null
  importTab.value = 'url'
  importDialogVisible.value = true
}

const handleFileChange = (file) => {
  importFile.value = file.raw
}
const handleFileRemove = () => {
  importFile.value = null
}

const toggleProductSelection = (idx) => {
  const p = importedProducts.value[idx]
  p._selected = p._selected === false ? true : false
}

const startImport = async () => {
  importLoading.value = true
  importStep.value = 2
  importedProducts.value = []
  importMeta.value = null

  try {
    let res
    if (importTab.value === 'url') {
      res = await api.post('/product-knowledge/import/url', {
        url: importUrl.value.trim(),
        note: importNote.value.trim(),
      })
    } else {
      // File upload via FormData
      const fd = new FormData()
      fd.append('file', importFile.value)
      res = await api.post('/product-knowledge/import/file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: { note: importNote.value.trim() }
      })
    }

    if (res.data.success) {
      importedProducts.value = (res.data.data || []).map(p => ({ ...p, _selected: true }))
      importMeta.value = res.data.meta || null
      
      if (importedProducts.value.length === 0) {
        ElMessage.warning(res.data.message || '未识别到产品，请尝试换网址或补充备注')
      } else {
        ElMessage.success(`成功识别 ${importedProducts.value.length} 个产品，请预览确认`)
      }
    } else {
      throw new Error(res.data.error || '导入失败')
    }
  } catch (error) {
    ElMessage.error('导入失败: ' + (error.message || '未知错误'))
    importStep.value = 1
  } finally {
    importLoading.value = false
  }
}

const batchImport = async () => {
  const selected = selectedProducts.value
  if (selected.length === 0) return

  batchLoading.value = true
  try {
    const res = await api.post('/product-knowledge/import/batch-create', {
      products: selected,
    })
    if (res.data.success) {
      ElMessage.success(`成功导入 ${res.data.count} 个产品！`)
      importDialogVisible.value = false
      loadProducts()
    } else {
      throw new Error(res.data.error || '导入失败')
    }
  } catch (error) {
    ElMessage.error('批量导入失败: ' + (error.message || ''))
  } finally {
    batchLoading.value = false
  }
}

// ── 原有方法 ──
const loadProducts = async () => {
  loading.value = true
  try {
    const res = await api.get('/product-knowledge/products')
    products.value = res.data.data || res.data
  } catch (error) {
    console.error('loadProducts error:', error)
    ElMessage.error('加载产品列表失败: ' + (error.response?.data?.error || error.message || ''))
  } finally {
    loading.value = false
  }
}

const showCreateDialog = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const resetForm = () => {
  formData.id = null
  formData.productNameCn = ''
  formData.productNameEn = ''
  formData.productDesc = ''
  formData.productImageUrl = ''
  formData.pricingUnit = 'kg'
  formData.basePrice = null
  formData.moq = null
  formData.deliveryDays = null
  formData.paymentTerms = ''
  formData.isActive = true
  formData.questions = []
}

const editProduct = (product) => {
  isEdit.value = true
  formData.id = product.id
  formData.productNameCn = product.productNameCn
  formData.productNameEn = product.productNameEn
  formData.productDesc = product.productDesc
  formData.productImageUrl = product.productImageUrl
  formData.pricingUnit = product.pricingUnit
  formData.basePrice = product.basePrice
  formData.moq = product.moq
  formData.deliveryDays = product.deliveryDays
  formData.paymentTerms = product.paymentTerms
  formData.isActive = product.isActive
  
  formData.questions = (product.questions || []).map(q => ({
    ...q,
    tempId: ++tempIdCounter,
    optionsList: q.optionsJson ? JSON.parse(q.optionsJson) : ['']
  }))
  
  dialogVisible.value = true
}

const addQuestion = (priority) => {
  formData.questions.push({
    tempId: ++tempIdCounter,
    questionCn: '',
    questionEn: '',
    questionType: 'text',
    optionsList: [''],
    priority: priority,
    sortOrder: formData.questions.length
  })
}

const removeQuestion = (question) => {
  const index = formData.questions.findIndex(q => q.tempId === question.tempId)
  if (index > -1) {
    formData.questions.splice(index, 1)
  }
}

const previewProductDetail = (product) => {
  previewProduct.value = product
  previewVisible.value = true
}

const parseOptions = (jsonStr) => {
  try {
    return JSON.parse(jsonStr)
  } catch {
    return []
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  
  submitting.value = true
  try {
    const questions = formData.questions.map((q, index) => ({
      questionCn: q.questionCn,
      questionEn: q.questionEn,
      questionType: q.questionType,
      optionsJson: (q.questionType === 'single_choice' || q.questionType === 'multiple_choice') && q.optionsList && q.optionsList.filter(s => s.trim()).length
        ? q.optionsList.filter(s => s.trim())
        : null,
      priority: q.priority,
      sortOrder: index
    }))

    const payload = {
      productNameCn: formData.productNameCn,
      productNameEn: formData.productNameEn,
      productDesc: formData.productDesc,
      productImageUrl: formData.productImageUrl,
      pricingUnit: formData.pricingUnit,
      basePrice: formData.basePrice,
      moq: formData.moq || null,
      deliveryDays: formData.deliveryDays || null,
      paymentTerms: formData.paymentTerms,
      isActive: formData.isActive,
      questions
    }

    if (isEdit.value) {
      await api.put(`/product-knowledge/products/${formData.id}`, payload)
    } else {
      await api.post('/product-knowledge/products', payload)
    }

    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    loadProducts()
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '操作失败')
  } finally {
    submitting.value = false
  }
}

const deleteProduct = async (product) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除产品"${product.productNameCn}"吗？`,
      '确认删除',
      { type: 'warning' }
    )
    await api.delete(`/product-knowledge/products/${product.id}`)
    ElMessage.success('删除成功')
    loadProducts()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const toggleProductStatus = async (product) => {
  try {
    await api.put(`/product-knowledge/products/${product.id}`, {
      isActive: product.isActive
    })
    ElMessage.success(product.isActive ? '已启用' : '已禁用')
  } catch (error) {
    product.isActive = !product.isActive
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadProducts()
})
</script>

<style scoped>
.page-actions {
  text-align: center;
  margin-bottom: 16px;
}

.product-knowledge-page {
  padding: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.product-card {
  background: var(--panel-header-bg);
  border: 1px solid var(--sidebar-active);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  width: 100%;
  box-sizing: border-box;
  transition: background 0.15s;
}

.product-card:active {
  background: var(--panel-header-bg);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-name .cn-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.product-name .en-name {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.product-info {
  margin: 8px 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.info-item .label {
  color: var(--text-secondary);
}

.info-item .value {
  color: var(--text-primary);
  font-weight: 500;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--sidebar-active);
}

/* ── 智能导入对话框 ── */
.import-tip-box {
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border: 1px solid #c8e6c9;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 18px;
}

:deep(.dark) .import-tip-box,
.import-tip-box {
  background: linear-gradient(135deg, rgba(46,125,50,0.15) 0%, rgba(56,142,60,0.08) 100%);
  border-color: rgba(76,175,80,0.3);
}

.tip-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.tip-list {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.tip-list b {
  color: var(--text-primary);
}

.import-input-group {
  margin-bottom: 14px;
}

.input-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.optional-tag {
  font-weight: 400;
  font-size: 12px;
  color: var(--text-secondary);
}

.input-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.upload-area {
  padding: 20px;
  text-align: center;
}

.upload-text {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.upload-text em {
  color: #409eff;
  font-style: normal;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.import-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--sidebar-active);
}

.import-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--panel-header-bg);
  border-radius: 10px;
}

.result-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.meta-info {
  color: var(--text-secondary);
  font-size: 13px;
}

.import-products-preview {
  max-height: 50vh;
  overflow-y: auto;
}

.preview-product-card {
  border: 1px solid var(--sidebar-active);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  transition: all 0.2s;
}

.preview-product-card.selected {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.05);
}

.preview-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.preview-names {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-cn {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.preview-en {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-body {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--sidebar-active);
}

.preview-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
}

.preview-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--text-primary);
}

/* ── Dialog styles ── */
:deep(.el-dialog) {
  max-width: 90vw;
  margin: 5vh auto;
  background: var(--panel-header-bg);
  border-radius: 12px;
}
:deep(.el-dialog__header) {
  background: var(--panel-header-bg);
  border-bottom: 1px solid var(--sidebar-active);
  padding: 16px 20px;
}
:deep(.el-dialog__title) {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
}
:deep(.el-dialog__headerbtn .el-dialog__close) {
  color: var(--text-secondary);
}
:deep(.el-dialog__body) {
  padding: 20px;
  background: var(--panel-header-bg);
}
:deep(.el-dialog__footer) {
  background: var(--panel-header-bg);
  border-top: 1px solid var(--sidebar-active);
  padding: 12px 20px;
}
:deep(.el-form-item__label) {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary) !important;
}
:deep(.el-divider__text) {
  color: var(--text-primary);
  background: var(--panel-header-bg);
}
:deep(.el-divider) {
  border-color: var(--sidebar-active);
}

.preview-content { padding: 0 4px; }
.preview-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
.preview-header h3 { margin: 0; font-size: 20px; color: var(--text-primary); }
.preview-en { color: var(--text-secondary); font-size: 14px; }
.preview-desc { color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 12px; }
.preview-pricing { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pricing-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--panel-header-bg); border-radius: 10px; }
.pricing-label { color: var(--text-secondary); font-size: 13px; }
.pricing-value { color: var(--text-primary); font-weight: 600; font-size: 14px; }
.preview-questions { margin-top: 4px; }
.question-item { padding: 12px; margin-bottom: 12px; background: var(--panel-header-bg); border: 1px solid var(--sidebar-active); border-radius: 10px; }
.question-header { display: flex; gap: 8px; margin-bottom: 8px; }
.question-cn { font-size: 15px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px; }
.question-en { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.question-options { display: flex; flex-wrap: wrap; gap: 6px; }
.option-tag { }

.question-edit-item {
  background: var(--panel-header-bg);
  border: 1px solid var(--sidebar-active);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}
</style>
