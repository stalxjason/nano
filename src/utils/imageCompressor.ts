/**
 * 客户端图片上传预压缩工具
 * 针对大尺寸、高分辨率参考图进行等比例缩放与质量优化
 * 避免超大 Base64 造成浏览器内存溢出、DOM 渲染卡死及 API 报 413 Payload Too Large / 网络超时
 */

export interface CompressOptions {
    /** 图片最大宽/高（像素），默认 1600 */
    maxDimension?: number
    /** 压缩质量 (0.1 - 1.0)，默认 0.85 */
    quality?: number
    /** 输出格式，默认 image/webp，若不支持自动回退 image/jpeg */
    outputType?: 'image/webp' | 'image/jpeg' | 'image/png'
    /** 触发压缩的文件大小阈值（字节），低于此大小且尺寸合规时直接读取，默认 400KB */
    sizeThresholdBytes?: number
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
    maxDimension: 1600,
    quality: 0.85,
    outputType: 'image/webp',
    sizeThresholdBytes: 400 * 1024 // 400KB
}

/**
 * 将 File 对象压缩并转换为 Data URL (Base64)
 */
export async function compressImageFile(file: File, options?: CompressOptions): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // 如果不是图片类型，直接使用普通 FileReader
    if (!file.type.startsWith('image/')) {
        return readFileAsDataUrl(file)
    }

    // SVG 或动图 GIF 不适合做有损重采样压缩，直接读取
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        return readFileAsDataUrl(file)
    }

    try {
        const imageBitmap = await loadImage(file)
        const { width, height } = imageBitmap

        // 如果文件体积较小且宽高都没有超过限制，无需重采样，保留原图
        if (file.size <= opts.sizeThresholdBytes && width <= opts.maxDimension && height <= opts.maxDimension) {
            return readFileAsDataUrl(file)
        }

        // 计算等比例缩放后的尺寸
        let targetWidth = width
        let targetHeight = height

        if (width > opts.maxDimension || height > opts.maxDimension) {
            if (width > height) {
                targetWidth = opts.maxDimension
                targetHeight = Math.round((height / width) * opts.maxDimension)
            } else {
                targetHeight = opts.maxDimension
                targetWidth = Math.round((width / height) * opts.maxDimension)
            }
        }

        // 使用 Canvas 进行高质量离屏重采样
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            return readFileAsDataUrl(file)
        }

        // 开启高质量图像插值平滑算法
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight)

        // 优先尝试导出指定格式，如果浏览器不支持 webp 则优雅降级为 jpeg
        let dataUrl = ''
        try {
            dataUrl = canvas.toDataURL(opts.outputType, opts.quality)
            // 某些老旧浏览器可能不支持 webp 导出，返回了 image/png 且体积更大，做下兜底
            if (opts.outputType === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
                dataUrl = canvas.toDataURL('image/jpeg', opts.quality)
            }
        } catch {
            dataUrl = canvas.toDataURL('image/jpeg', opts.quality)
        }

        // 如果压缩后反而比原图大（极少数极端情况），回退到原图
        if (dataUrl && dataUrl.length > file.size * 1.5) {
            return readFileAsDataUrl(file)
        }

        return dataUrl || readFileAsDataUrl(file)
    } catch (err) {
        console.warn('图片压缩处理失败，降级读取原图:', err)
        return readFileAsDataUrl(file)
    }
}

/**
 * 辅助函数：从 File 载入 HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
            URL.revokeObjectURL(url)
            resolve(img)
        }

        img.onerror = (err) => {
            URL.revokeObjectURL(url)
            reject(err)
        }

        img.src = url
    })
}

/**
 * 辅助函数：原生 FileReader 读取 DataURL
 */
function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result)
            } else {
                reject(new Error('无法读取文件内容'))
            }
        }
        reader.onerror = () => reject(reader.error || new Error('文件读取错误'))
        reader.onabort = () => reject(new Error('文件读取被中断'))
        reader.readAsDataURL(file)
    })
}
