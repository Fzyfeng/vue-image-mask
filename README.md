# Vue Image Mask

一个Vue 3组件，允许用户在图片上添加蒙版/涂鸦，并生成修改后的图片。

## 功能特性

- 在图片上绘制透明蒙版
- 可调节笔刷大小和硬度
- 支持撤销/重做操作
- 支持图片缩放和平移
- 响应式设计

## 安装

```bash
npm install vue-image-mask
```

## 使用方法

```vue
<template>
  <div>
    <el-upload
        class="upload-section"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        @change="loadImage"
    >
      <el-button type="primary">选择图片</el-button>
    </el-upload>
    <vue-image-mask ref="imageMaskRef" @save-image="handleSaveImage" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {ElButton, ElUpload,} from 'element-plus'
import VueImageMask from 'vue-image-mask'

const imageMaskRef = ref()

const loadImage = (event) => {
  const file = event.raw;
  if (!file) return;
  const imageUrl = URL.createObjectURL(file); // ✅ 转换为临时 URL
  imageMaskRef.value.openMask(imageUrl);
};
</script>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| - | - | - | - |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| save-image | (dataUrl: string) | 当用户保存图片时触发 |

### Methods

| 方法名 | 参数 | 说明 |
|--------|------|------|
| openMask | (imageSrc: string) | 打开图片编辑器 |

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建

```bash
npm run build
```

## 许可证

[ISC](./LICENSE)