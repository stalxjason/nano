<template>
    <div
        ref="uploadArea"
        class="min-w-0 rounded-xl transition-colors"
        :class="isDragOver ? 'bg-amber-50 ring-2 ring-amber-400' : ''"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
    >
        <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="handleFileSelect" />

        <button
            v-if="!thumbnails.length"
            type="button"
            @click="fileInput?.click()"
            :disabled="isProcessing"
            class="w-full min-h-[40px] px-3 py-2 border border-dashed border-slate-300 rounded-xl flex flex-wrap items-center gap-x-2 gap-y-1 text-left text-xs text-slate-500 hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
            <span v-if="isProcessing" class="flex items-center gap-1.5 text-amber-600 font-medium">
                <span class="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>正在优化并载入图片...</span>
            </span>
            <template v-else>
                <span class="font-medium text-slate-700">＋ 添加参考图片</span>
                <span>支持拖拽或 Ctrl / ⌘ + V 粘贴 (已启用自动无损/高质缩放)</span>
            </template>
        </button>

        <div v-else class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-slate-600">参考素材 · {{ thumbnails.length }} 张</span>
                    <span v-if="isProcessing" class="text-amber-600 flex items-center gap-1">
                        <span class="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>正在处理新图片...</span>
                    </span>
                    <span v-else class="text-slate-400">支持拖拽或粘贴</span>
                </div>
                <button type="button" @click="clearAllImages" class="text-slate-400 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded transition-colors">
                    清空全部
                </button>
            </div>

            <div class="flex flex-wrap items-start gap-2">
                <div
                    v-for="(thumbnail, index) in thumbnails"
                    :key="index"
                    class="relative w-[72px] h-[72px] shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                >
                    <img :src="thumbnail" :alt="`参考图 ${index + 1}`" class="w-full h-full object-contain" />
                    <span class="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white font-mono">{{ index + 1 }}</span>
                    <button
                        type="button"
                        @click="removeThumbnail(index)"
                        :aria-label="`移除参考图 ${index + 1}`"
                        title="移除此图"
                        class="absolute top-0 right-0 w-6 h-6 bg-black/60 hover:bg-rose-600 text-white rounded-bl-lg flex items-center justify-center text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white transition-colors"
                    >✕</button>
                </div>
                <button
                    type="button"
                    @click="fileInput?.click()"
                    :disabled="isProcessing"
                    class="w-[72px] h-[72px] shrink-0 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <template v-if="isProcessing">
                        <span class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span class="text-[10px] text-amber-600">处理中</span>
                    </template>
                    <template v-else>
                        <span class="text-lg leading-none" aria-hidden="true">＋</span>
                        <span class="text-[11px]">继续添加</span>
                    </template>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { compressImageFile } from '../utils/imageCompressor'

const props = defineProps<{
    modelValue: string[]
}>()

const emit = defineEmits<{
    'update:modelValue': [value: string[]]
}>()

const fileInput = ref<HTMLInputElement>()
const uploadArea = ref<HTMLElement>()
const isDragOver = ref(false)
const isProcessing = ref(false)
const thumbnails = computed(() => props.modelValue)

const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (target.files) {
        handleFiles(Array.from(target.files))
        target.value = ''
    }
}

const handleDragEnter = () => {
    isDragOver.value = true
}

const handleDragOver = () => {
    isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
    if (!uploadArea.value?.contains(event.relatedTarget as Node)) {
        isDragOver.value = false
    }
}

const handleDrop = (event: DragEvent) => {
    isDragOver.value = false
    if (event.dataTransfer?.files) {
        handleFiles(Array.from(event.dataTransfer.files))
    }
}

// 串行批次处理，保证有序并避免并发更新竞争
let pendingUploads = Promise.resolve()
let uploadVersion = 0
const handleFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    const version = uploadVersion
    isProcessing.value = true

    pendingUploads = pendingUploads.then(async () => {
        try {
            // 采用客户端智能预压缩，将大图重采样至最大 1600px，极大减少 Base64 内存和 Payload 压力
            const images = await Promise.all(
                imageFiles.map(file => compressImageFile(file, {
                    maxDimension: 1600,
                    quality: 0.85,
                    outputType: 'image/webp'
                }))
            )
            if (version !== uploadVersion) return
            const loaded = images.filter((image): image is string => Boolean(image))
            if (loaded.length) {
                // 最多支持保留 12 张参考图
                const updated = [...props.modelValue, ...loaded].slice(0, 12)
                emit('update:modelValue', updated)
            }
        } finally {
            if (version === uploadVersion) {
                isProcessing.value = false
            }
        }
    })
}

const removeThumbnail = (index: number) => {
    emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

const clearAllImages = () => {
    uploadVersion++
    isProcessing.value = false
    emit('update:modelValue', [])
}

const onGlobalPaste = (event: ClipboardEvent) => {
    // v-show 隐藏状态下不处理粘贴
    if (!uploadArea.value?.getClientRects().length || event.defaultPrevented) return
    const files = Array.from(event.clipboardData?.items || [])
        .filter(item => item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null)
    if (files.length) {
        event.preventDefault()
        handleFiles(files)
    }
}

onMounted(() => window.addEventListener('paste', onGlobalPaste))
onUnmounted(() => {
    uploadVersion++
    window.removeEventListener('paste', onGlobalPaste)
})
</script>
