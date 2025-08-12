<template>
  <el-dialog
      v-model="dialogVisible"
      title="给图片添加蒙版"
      width="80%"
      top="5vh"
      :modal="true"
      :show-close="true"
      @close="handleClose"
      @opened="onDialogOpened"
      class="image-mask-dialog"
      :append-to-body="true"
      :close-on-click-modal="false"
  >
    <div class="mask-editor">

      <!-- 画布容器 -->
      <div
        ref="canvasContainer"
        class="canvas-container"
        :class="containerClasses"
        @wheel.prevent="handleWheel"
        @mousedown="handleContainerMouseDown"
        @mousemove="handleContainerMouseMove"
        @mouseup="handleContainerMouseUp"
        @mouseleave="handleContainerMouseLeave"
        @touchstart.prevent="handleContainerTouchStart"
        @touchmove.prevent="handleContainerTouchMove"
        @touchend.prevent="handleContainerTouchEnd"
      >
        <canvas
          ref="mainCanvas"
          class="main-canvas"
          :style="canvasStyle"
        ></canvas>

        <!-- 自定义光标 -->
        <div
          v-if="editorMode === 'brush' && showCursor"
          class="brush-cursor"
          :style="cursorStyle"
        ></div>
      </div>

      <!-- 状态信息 -->
      <div class="status-bar">
        <span style="width: 120px">缩放: {{ Math.round(viewport.scale * 100) }}%</span>
        <!-- 工具栏 -->
        <div class="toolbar">
          <transition name="fade" mode="out-in">
            <div v-if="editorMode === 'brush'" class="tool-group brush-controls" key="brush">
              <span class="tool-label">笔刷大小：</span>
              <el-slider
                  v-model="brushSize"
                  :min="5"
                  :max="100"
                  :step="1"
                  style="width: 120px; margin: 0 8px;"
              />
              <span class="brush-size-value">{{ brushSize }}px</span>

              <span class="tool-label" style="margin-left: 16px;">硬度：</span>
              <el-slider
                  v-model="brushHardness"
                  :min="0"
                  :max="100"
                  :step="5"
                  style="width: 100px; margin: 0 8px;"
              />
              <span class="brush-size-value">{{ brushHardness }}%</span>
            </div>
          </transition>
          <div class="tool-group">
            <span class="tool-label">编辑模式：</span>
            <el-button-group>
              <el-button
                  :type="editorMode === 'brush' ? 'primary' : 'default'"
                  @click="setMode('brush')"
                  size="small"
              >
                笔刷
              </el-button>
              <el-button
                  :type="editorMode === 'pan' ? 'primary' : 'default'"
                  @click="setMode('pan')"
                  size="small"
              >
                拖拽
              </el-button>
            </el-button-group>
          </div>

          <div class="tool-group">
            <el-button @click="resetImage" size="small">重置</el-button>
            <el-button @click="undoAction" :disabled="!canUndo" size="small">撤销</el-button>
            <el-button @click="redoAction" :disabled="!canRedo" size="small">还原</el-button>
          </div>

          <div class="tool-group">
            <el-button type="success" @click="saveImage" size="small">保存</el-button>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>


<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'

// 组件事件
const emit = defineEmits(['save-image'])

// 核心状态
const dialogVisible = ref(false)
const editorMode = ref('brush') // 'brush' | 'pan'
const brushSize = ref(20)
const brushHardness = ref(50) // 笔刷硬度 0-100

// Canvas 引用
const canvasContainer = ref(null)
const mainCanvas = ref(null)

// 图像数据
const originalImageData = ref(null)
const currentImageData = ref(null)

// 视口状态 (用于缩放和平移)
const viewport = ref({
  x: 0,
  y: 0,
  scale: 1
})

// 交互状态
const isInteracting = ref(false)
const lastPointer = ref({ x: 0, y: 0 })
const currentPointer = ref({ x: 0, y: 0 })
const showCursor = ref(false)

// 历史记录 (撤销/重做)
const history = ref([])
const historyIndex = ref(-1)
const maxHistorySize = 50

// 计算属性
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const containerClasses = computed(() => ({
  'brush-mode': editorMode.value === 'brush',
  'pan-mode': editorMode.value === 'pan',
  'interacting': isInteracting.value
}))

const canvasStyle = computed(() => ({
  transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.scale})`,
  transformOrigin: '0 0'
}))

const cursorStyle = computed(() => ({
  left: `${currentPointer.value.x}px`,
  top: `${currentPointer.value.y}px`,
  width: `${brushSize.value * viewport.value.scale}px`,
  height: `${brushSize.value * viewport.value.scale}px`
}))

const pendingImage = ref(null)

const onDialogOpened = async () => {
  if (pendingImage.value) {
    await initializeCanvas(pendingImage.value)
    pendingImage.value = null
  }
}

const openMask = async (imageSrc) => {
  try {
    const img = await loadImage(imageSrc)
    if (dialogVisible.value) {
      // 如果对话框已经打开，直接初始化
      await initializeCanvas(img)
    } else {
      // 否则保存图片，等对话框打开后再初始化
      pendingImage.value = img
      dialogVisible.value = true
    }
  } catch (error) {
    console.error('Failed to load image:', error)
  }
}

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // 设置crossOrigin属性以避免Canvas污染
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (error) => {
      console.error('Image load error:', error)
      reject(error)
    }
    img.src = src
  })
}

const initializeCanvas = async (img) => {
  await nextTick()
  if (!mainCanvas.value) {
    await nextTick()
  }

  const canvas = mainCanvas.value

  if (!canvas) {
    throw new Error('Canvas element not found')
  }

  try {
    // 设置画布尺寸
    canvas.width = img.width
    canvas.height = img.height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // 绘制原始图像
    ctx.drawImage(img, 0, 0)

    // 尝试获取图像数据，如果失败则使用备用方案
    try {
      originalImageData.value = ctx.getImageData(0, 0, img.width, img.height)
      currentImageData.value = ctx.getImageData(0, 0, img.width, img.height)
    } catch (securityError) {
      console.warn('Canvas tainted by cross-origin data, using alternative approach:', securityError)
      // 备用方案：保存图片对象本身，而不是ImageData
      originalImageData.value = {
        isImageElement: true,
        image: img,
        width: img.width,
        height: img.height
      }
      currentImageData.value = null
    }

    // 重置视口
    resetViewport()

    // 初始化历史记录
    saveToHistory()

  } catch (error) {
    console.error('Failed to initialize canvas:', error)
    throw error
  }
}

const resetViewport = () => {
  const canvas = mainCanvas.value
  const container = canvasContainer.value
  if (!canvas || !container) return

  const containerRect = container.getBoundingClientRect()
  const canvasAspect = canvas.width / canvas.height
  const containerAspect = containerRect.width / containerRect.height

  let scale = 1
  if (canvasAspect > containerAspect) {
    scale = (containerRect.width * 0.8) / canvas.width
  } else {
    scale = (containerRect.height * 0.8) / canvas.height
  }

  viewport.value = {
    x: (containerRect.width - canvas.width * scale) / 2,
    y: (containerRect.height - canvas.height * scale) / 2,
    scale: Math.max(0.1, Math.min(scale, 5))
  }
}

// 工具方法
const setMode = (mode) => {
  editorMode.value = mode
  if (mode === 'brush') {
    showCursor.value = true
  } else {
    showCursor.value = false
  }
}

const getPointerPosition = (e) => {
  const container = canvasContainer.value
  if (!container) return { x: 0, y: 0 }

  const rect = container.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
}

const getCanvasPosition = (containerPos) => {
  return {
    x: (containerPos.x - viewport.value.x) / viewport.value.scale,
    y: (containerPos.y - viewport.value.y) / viewport.value.scale
  }
}

// 事件处理
const handleContainerMouseDown = (e) => {
  e.preventDefault()
  const pos = getPointerPosition(e)
  startInteraction(pos)
}

const handleContainerMouseMove = (e) => {
  const pos = getPointerPosition(e)
  updatePointer(pos)
  if (isInteracting.value) {
    continueInteraction(pos)
  }
}

const handleContainerMouseUp = () => {
  endInteraction()
}

const handleContainerMouseLeave = () => {
  showCursor.value = false
  endInteraction()
}

// 触摸事件
const handleContainerTouchStart = (e) => {
  const pos = getPointerPosition(e)
  startInteraction(pos)
}

const handleContainerTouchMove = (e) => {
  const pos = getPointerPosition(e)
  updatePointer(pos)
  if (isInteracting.value) {
    continueInteraction(pos)
  }
}

const handleContainerTouchEnd = () => {
  endInteraction()
}

// 交互逻辑
const startInteraction = (pos) => {
  isInteracting.value = true
  lastPointer.value = { ...pos }

  if (editorMode.value === 'brush') {
    startBrushStroke(pos)
  }
}

const continueInteraction = (pos) => {
  if (editorMode.value === 'brush') {
    continueBrushStroke(pos)
  } else if (editorMode.value === 'pan') {
    panViewport(pos)
  }

  lastPointer.value = { ...pos }
}

const endInteraction = () => {
  if (isInteracting.value && editorMode.value === 'brush') {
    endBrushStroke()
  }
  isInteracting.value = false
}

const updatePointer = (pos) => {
  currentPointer.value = { ...pos }
  showCursor.value = editorMode.value === 'brush'
}

// 创建柔和笔刷渐变
const createSoftBrush = (ctx, x, y, size) => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size / 2)

  // 根据硬度调整渐变
  const hardness = brushHardness.value / 100
  const coreSize = hardness * 0.8 // 核心区域大小
  const fadeStart = Math.max(0.1, coreSize) // 渐变开始位置

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(fadeStart, `rgba(255, 255, 255, ${0.9 + hardness * 0.1})`)
  gradient.addColorStop(Math.min(0.95, fadeStart + 0.3), `rgba(255, 255, 255, ${0.3 + hardness * 0.4})`)
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  return gradient
}

// 绘制柔和笔刷点
const drawSoftBrushPoint = (ctx, x, y, size) => {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = createSoftBrush(ctx, x, y, size)
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// 笔刷功能
let lastBrushPos = null

const startBrushStroke = (pos) => {
  const canvasPos = getCanvasPosition(pos)
  const canvas = mainCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 绘制起始点
  drawSoftBrushPoint(ctx, canvasPos.x, canvasPos.y, brushSize.value)
  lastBrushPos = canvasPos
}

const continueBrushStroke = (pos) => {
  const canvasPos = getCanvasPosition(pos)
  const canvas = mainCanvas.value
  if (!canvas || !lastBrushPos) return

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 计算两点间的距离
  const dx = canvasPos.x - lastBrushPos.x
  const dy = canvasPos.y - lastBrushPos.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // 如果距离太小，不绘制
  if (distance < 1) return

  // 根据硬度调整绘制密度，硬度越高密度越大
  const hardness = brushHardness.value / 100
  const spacing = brushSize.value * (0.05 + (1 - hardness) * 0.15) // 硬度高时间距小
  const steps = Math.max(1, Math.floor(distance / spacing))

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = lastBrushPos.x + dx * t
    const y = lastBrushPos.y + dy * t
    drawSoftBrushPoint(ctx, x, y, brushSize.value)
  }

  lastBrushPos = canvasPos
}

const endBrushStroke = () => {
  lastBrushPos = null
  // 保存当前状态到历史记录
  saveToHistory()
}

// 平移视口
const panViewport = (pos) => {
  const deltaX = pos.x - lastPointer.value.x
  const deltaY = pos.y - lastPointer.value.y

  viewport.value.x += deltaX
  viewport.value.y += deltaY
}

// 缩放功能
const handleWheel = (e) => {
  const pos = getPointerPosition(e)
  const canvasPos = getCanvasPosition(pos)

  const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.1, Math.min(viewport.value.scale * scaleFactor, 5))

  if (newScale !== viewport.value.scale) {
    // 以鼠标位置为中心缩放
    viewport.value.x = pos.x - canvasPos.x * newScale
    viewport.value.y = pos.y - canvasPos.y * newScale
    viewport.value.scale = newScale
  }
}

// 历史记录管理
const saveToHistory = () => {
  const canvas = mainCanvas.value
  if (!canvas) return

  try {
    const ctx = canvas.getContext('2d')
    let historyData

    try {
      // 尝试获取ImageData
      historyData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } catch (securityError) {
      // 如果Canvas被污染，使用toDataURL作为备用方案
      console.warn('Cannot save ImageData due to canvas taint, using DataURL')
      historyData = {
        isDataURL: true,
        dataURL: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      }
    }

    // 移除当前索引之后的历史记录
    history.value = history.value.slice(0, historyIndex.value + 1)

    // 添加新的历史记录
    history.value.push(historyData)

    // 限制历史记录大小
    if (history.value.length > maxHistorySize) {
      history.value.shift()
    } else {
      historyIndex.value++
    }
  } catch (error) {
    console.error('Failed to save to history:', error)
  }
}

const undoAction = () => {
  if (!canUndo.value) return

  historyIndex.value--
  restoreFromHistory()
}

const redoAction = () => {
  if (!canRedo.value) return

  historyIndex.value++
  restoreFromHistory()
}

const restoreFromHistory = () => {
  const canvas = mainCanvas.value
  if (!canvas || historyIndex.value < 0 || historyIndex.value >= history.value.length) return

  const ctx = canvas.getContext('2d')
  const historyData = history.value[historyIndex.value]

  try {
    if (historyData.isDataURL) {
      // 从DataURL恢复
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      img.src = historyData.dataURL
    } else {
      // 从ImageData恢复
      ctx.putImageData(historyData, 0, 0)
    }
  } catch (error) {
    console.error('Failed to restore from history:', error)
  }
}
// 重置图像
const resetImage = () => {
  const canvas = mainCanvas.value
  if (!canvas || !originalImageData.value) return

  const ctx = canvas.getContext('2d')

  try {
    if (originalImageData.value.isImageElement) {
      // 使用原始图片对象重新绘制
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(originalImageData.value.image, 0, 0)
    } else {
      // 使用ImageData恢复
      ctx.putImageData(originalImageData.value, 0, 0)
    }

    // 重置视口
    resetViewport()

    // 重置历史记录
    history.value = []
    historyIndex.value = -1
    saveToHistory()
  } catch (error) {
    console.error('Failed to reset image:', error)
  }
}

// 保存图像
const saveImage = () => {
  const canvas = mainCanvas.value
  if (!canvas) return

  const dataUrl = canvas.toDataURL('image/png')
  emit('save-image', dataUrl)
  handleClose()
}

// 关闭对话框
const handleClose = () => {
  dialogVisible.value = false

  // 清理状态
  isInteracting.value = false
  showCursor.value = false
  editorMode.value = 'brush'

  // 清理数据
  originalImageData.value = null
  currentImageData.value = null
  history.value = []
  historyIndex.value = -1
}

// 生命周期
onMounted(() => {
  // 可以在这里添加键盘事件监听等
})

onUnmounted(() => {
  // 清理事件监听器
})

// 暴露方法给父组件
defineExpose({
  openMask
})
</script>

<style scoped>
.image-mask-dialog {
  --primary-color: #409eff;
  --border-color: #dcdfe6;
  --bg-color: #f5f7fa;
}

.mask-editor {
  display: flex;
  flex-direction: column;
  height: 75vh;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 16px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
}

.brush-size-value {
  font-size: 12px;
  color: #909399;
  min-width: 35px;
}

.canvas-container {
  flex: 1;
  position: relative;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  user-select: none;
}

.canvas-container.brush-mode {
  cursor: none;
}

.canvas-container.pan-mode {
  cursor: grab;
}

.canvas-container.pan-mode.interacting {
  cursor: grabbing;
}

.main-canvas {
  display: block;
  transition: transform 0.1s ease-out;
}

.brush-cursor {
  position: absolute;
  border: 2px solid var(--primary-color);
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 10;
  opacity: 0.8;
  background: radial-gradient(
    circle,
    rgba(64, 133, 255, 0.2) 0%,
    rgba(64, 133, 255, 0.1) 70%,
    transparent 100%
  );
  box-shadow:
    0 0 0 1px rgba(64, 133, 255, 0.3),
    inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  color: #909399;
  min-height: 72px; /* 固定最小高度避免抖动 */
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 16px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  flex-wrap: wrap;
  min-height: 44px; /* 固定最小高度 */
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brush-controls {
  transition: all 0.3s ease;
}

/* 淡入淡出动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.tool-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
}

.brush-size-value {
  font-size: 12px;
  color: #909399;
  min-width: 35px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .mask-editor {
    height: 70vh;
  }

  .toolbar {
    gap: 12px;
    padding: 8px 12px;
  }

  .tool-group {
    gap: 6px;
  }

  .tool-label {
    font-size: 12px;
  }

  .status-bar {
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .tool-group {
    justify-content: center;
  }
}
</style>
