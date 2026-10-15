import type { HistoryRecord } from '../types'

const DB_NAME = 'nanobanana_studio_db'
const DB_VERSION = 1
const STORE_NAME = 'generation_history'
const DEFAULT_MAX_ITEMS = 50

let dbPromise: Promise<IDBDatabase | null> | null = null

function getDatabase(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return Promise.resolve(null)
    }

    if (!dbPromise) {
        dbPromise = new Promise((resolve) => {
            try {
                const request = window.indexedDB.open(DB_NAME, DB_VERSION)

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
                        store.createIndex('timestamp', 'timestamp', { unique: false })
                    }
                }

                request.onsuccess = () => {
                    resolve(request.result)
                }

                request.onerror = (event) => {
                    console.warn('打开 IndexedDB 失败，将使用内存存储:', event)
                    resolve(null)
                }
            } catch (err) {
                console.warn('IndexedDB 初始化异常:', err)
                resolve(null)
            }
        })
    }

    return dbPromise
}

// 内存降级备用列表
let fallbackMemoryHistory: HistoryRecord[] = []

/**
 * 获取所有本地持久化的生成历史，按时间倒序排列
 */
export async function getHistoryRecords(): Promise<HistoryRecord[]> {
    const db = await getDatabase()
    if (!db) {
        return [...fallbackMemoryHistory].sort((a, b) => b.timestamp - a.timestamp)
    }

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(STORE_NAME, 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const index = store.index('timestamp')
            const request = index.openCursor(null, 'prev')
            const records: HistoryRecord[] = []

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
                if (cursor) {
                    records.push(cursor.value)
                    cursor.continue()
                } else {
                    resolve(records)
                }
            }

            request.onerror = () => {
                console.warn('从 IndexedDB 读取历史失败')
                resolve([])
            }
        } catch (err) {
            console.warn('查询 IndexedDB 事务异常:', err)
            resolve([])
        }
    })
}

/**
 * 插入一条新的生成历史，并自动控制最大保留数量，防止磁盘过度占用
 */
export async function saveHistoryRecord(record: HistoryRecord, maxItems = DEFAULT_MAX_ITEMS): Promise<void> {
    fallbackMemoryHistory.unshift(record)
    if (fallbackMemoryHistory.length > maxItems) {
        fallbackMemoryHistory.pop()
    }

    const db = await getDatabase()
    if (!db) return

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            store.put(record)

            transaction.oncomplete = async () => {
                // 清理超过上限的最旧记录
                await trimOldRecords(db, maxItems)
                resolve()
            }

            transaction.onerror = (err) => {
                console.warn('写入 IndexedDB 失败:', err)
                resolve()
            }
        } catch (err) {
            console.warn('保存历史到 IndexedDB 异常:', err)
            resolve()
        }
    })
}

/**
 * 删除单条历史记录
 */
export async function deleteHistoryRecord(id: string): Promise<void> {
    fallbackMemoryHistory = fallbackMemoryHistory.filter(item => item.id !== id)

    const db = await getDatabase()
    if (!db) return

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            store.delete(id)
            transaction.oncomplete = () => resolve()
            transaction.onerror = () => resolve()
        } catch {
            resolve()
        }
    })
}

/**
 * 清空全部历史记录
 */
export async function clearAllHistoryRecords(): Promise<void> {
    fallbackMemoryHistory = []

    const db = await getDatabase()
    if (!db) return

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            store.clear()
            transaction.oncomplete = () => resolve()
            transaction.onerror = () => resolve()
        } catch {
            resolve()
        }
    })
}

/**
 * 辅助方法：清除超出上限的最旧记录
 */
async function trimOldRecords(db: IDBDatabase, maxItems: number): Promise<void> {
    try {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const countRequest = store.count()

        countRequest.onsuccess = () => {
            const count = countRequest.result
            if (count > maxItems) {
                const deleteCount = count - maxItems
                const index = store.index('timestamp')
                const cursorRequest = index.openCursor(null, 'next') // 从最老的开始删
                let deleted = 0

                cursorRequest.onsuccess = (e) => {
                    const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
                    if (cursor && deleted < deleteCount) {
                        cursor.delete()
                        deleted++
                        cursor.continue()
                    }
                }
            }
        }
    } catch {
        // 忽略裁剪异常
    }
}
