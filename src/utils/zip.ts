/**
 * 纯前端零依赖 Store 模式 ZIP 归档打包工具
 * 专为图片文件设计：由于 JPG/PNG/WebP 本身已高强度压缩，采用 Store 模式无需重复压缩，速度极快（毫秒级完成打包）
 * 并自带 prompt.txt 生成参数记录
 */

// CRC32 预计算查找表
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    CRC_TABLE[i] = c >>> 0
}

function calculateCrc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xFF]
    }
    return (crc ^ 0xFFFFFFFF) >>> 0
}

export interface ZipFileInput {
    name: string
    data: Uint8Array | string
}

/**
 * 将文件列表打包为标准的 .zip 格式 Blob
 */
export function createZipBlob(files: ZipFileInput[]): Blob {
    const encoder = new TextEncoder()
    const fileEntries: {
        nameBytes: Uint8Array
        dataBytes: Uint8Array
        crc: number
        offset: number
    }[] = []

    const chunks: BlobPart[] = []
    let currentOffset = 0

    // 1. 写入 Local File Headers & Data
    for (const file of files) {
        const nameBytes = encoder.encode(file.name)
        const dataBytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data
        const crc = calculateCrc32(dataBytes)

        const localHeader = new Uint8Array(30 + nameBytes.length)
        const view = new DataView(localHeader.buffer)

        // Local file header signature (0x04034b50)
        view.setUint32(0, 0x04034b50, true)
        // Version needed to extract (2.0)
        view.setUint16(4, 20, true)
        // General purpose bit flag
        view.setUint16(6, 0, true)
        // Compression method (0 = store)
        view.setUint16(8, 0, true)
        // File last mod time & date
        view.setUint16(10, 0, true)
        view.setUint16(12, 0, true)
        // CRC-32
        view.setUint32(14, crc, true)
        // Compressed size
        view.setUint32(18, dataBytes.length, true)
        // Uncompressed size
        view.setUint32(22, dataBytes.length, true)
        // File name length
        view.setUint16(26, nameBytes.length, true)
        // Extra field length
        view.setUint16(28, 0, true)

        localHeader.set(nameBytes, 30)

        chunks.push(localHeader as unknown as BlobPart)
        chunks.push(dataBytes as unknown as BlobPart)

        fileEntries.push({
            nameBytes,
            dataBytes,
            crc,
            offset: currentOffset
        })

        currentOffset += localHeader.length + dataBytes.length
    }

    const centralDirectoryStartOffset = currentOffset
    let centralDirectorySize = 0

    // 2. 写入 Central Directory Headers
    for (const entry of fileEntries) {
        const cdHeader = new Uint8Array(46 + entry.nameBytes.length)
        const view = new DataView(cdHeader.buffer)

        // Central directory header signature (0x02014b50)
        view.setUint32(0, 0x02014b50, true)
        // Version made by
        view.setUint16(4, 20, true)
        // Version needed to extract
        view.setUint16(6, 20, true)
        // General purpose bit flag
        view.setUint16(8, 0, true)
        // Compression method (0 = store)
        view.setUint16(10, 0, true)
        // File last mod time & date
        view.setUint16(12, 0, true)
        view.setUint16(14, 0, true)
        // CRC-32
        view.setUint32(16, entry.crc, true)
        // Compressed size
        view.setUint32(20, entry.dataBytes.length, true)
        // Uncompressed size
        view.setUint32(24, entry.dataBytes.length, true)
        // File name length
        view.setUint16(28, entry.nameBytes.length, true)
        // Extra field length
        view.setUint16(30, 0, true)
        // File comment length
        view.setUint16(32, 0, true)
        // Disk number start
        view.setUint16(34, 0, true)
        // Internal file attributes
        view.setUint16(36, 0, true)
        // External file attributes
        view.setUint32(38, 0, true)
        // Relative offset of local header
        view.setUint32(42, entry.offset, true)

        cdHeader.set(entry.nameBytes, 46)

        chunks.push(cdHeader as unknown as BlobPart)
        centralDirectorySize += cdHeader.length
    }

    // 3. 写入 End of Central Directory Record (EOCD)
    const eocd = new Uint8Array(22)
    const view = new DataView(eocd.buffer)

    // End of central dir signature (0x06054b50)
    view.setUint32(0, 0x06054b50, true)
    // Number of this disk
    view.setUint16(4, 0, true)
    // Disk where central directory starts
    view.setUint16(6, 0, true)
    // Number of central directory records on this disk
    view.setUint16(8, fileEntries.length, true)
    // Total number of central directory records
    view.setUint16(10, fileEntries.length, true)
    // Size of central directory
    view.setUint32(12, centralDirectorySize, true)
    // Offset of start of central directory
    view.setUint32(16, centralDirectoryStartOffset, true)
    // Comment length
    view.setUint16(20, 0, true)

    chunks.push(eocd as unknown as BlobPart)

    return new Blob(chunks, { type: 'application/zip' })
}

/**
 * 将包含 base64 或 HTTP URL 的图片列表打包并触发浏览器原生下载一个 .zip 文件
 */
export async function downloadImagesAsZip(
    images: string[],
    options?: {
        zipFileName?: string
        promptText?: string
        modelName?: string
    }
): Promise<void> {
    if (!images || images.length === 0) return

    const files: ZipFileInput[] = []

    // 1. 如果有提示词信息，写入 prompt.txt
    if (options?.promptText) {
        const promptInfo = [
            `【提示词 (Prompt)】`,
            options.promptText,
            '',
            options.modelName ? `【使用模型】: ${options.modelName}` : '',
            `【生成时间】: ${new Date().toLocaleString()}`,
            `【图片数量】: ${images.length} 张`,
            '',
            `Generated by NanoBanana Studio`
        ].filter(Boolean).join('\n')

        files.push({
            name: 'generation-info.txt',
            data: promptInfo
        })
    }

    // 2. 将每张图片转为 Uint8Array
    for (let i = 0; i < images.length; i++) {
        const item = images[i]
        let extension = 'png'
        let bytes: Uint8Array

        if (item.startsWith('data:')) {
            const matches = item.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/)
            if (matches) {
                const mimeSub = matches[1].toLowerCase()
                extension = mimeSub === 'jpeg' ? 'jpg' : mimeSub
                const binaryStr = atob(matches[2])
                bytes = new Uint8Array(binaryStr.length)
                for (let k = 0; k < binaryStr.length; k++) {
                    bytes[k] = binaryStr.charCodeAt(k)
                }
            } else {
                continue
            }
        } else {
            // 网络 URL
            try {
                const res = await fetch(item)
                const buf = await res.arrayBuffer()
                bytes = new Uint8Array(buf)
                const contentType = res.headers.get('content-type') || ''
                if (contentType.includes('jpeg')) extension = 'jpg'
                else if (contentType.includes('webp')) extension = 'webp'
            } catch {
                continue
            }
        }

        const paddedIndex = String(i + 1).padStart(2, '0')
        files.push({
            name: `nanobanana_${paddedIndex}.${extension}`,
            data: bytes
        })
    }

    if (!files.length) return

    const zipBlob = createZipBlob(files)
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = options?.zipFileName || `nanobanana_batch_${Date.now()}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
