import { useState, useEffect, useCallback } from 'react'
import { useConnection } from '../contexts/ConnectionContext'

const CHUNK_SIZE = 15 * 1024

export interface RagDocument {
  doc_id: string
  source: string
  chunks: number
}

export const useRAG = () => {
  const { sendRawRef, onRagMessageRef, authState } = useConnection()
  const [documents, setDocuments] = useState<RagDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onRagMessageRef.current = (msg: any) => {
      if (msg.type === 'rag_list_response') {
        setDocuments(msg.documents ?? [])
        setLoading(false)
      } else if (msg.type === 'rag_delete_response') {
        setDocuments((prev) => prev.filter((d) => d.doc_id !== msg.docId))
      } else if (msg.type === 'rag_upload_response') {
        setUploading(false)
        setError(null)
        sendRawRef.current?.(JSON.stringify({ type: 'rag_list' }))
      } else if (msg.type === 'rag_error') {
        setError(msg.message ?? 'Unknown error')
        setLoading(false)
        setUploading(false)
      }
    }
    return () => { onRagMessageRef.current = null }
  }, [])

  useEffect(() => {
    if (authState !== 'ready') {
      setUploading(false)
      setLoading(false)
    }
  }, [authState])

  const loadDocuments = useCallback(() => {
    if (!sendRawRef.current) return
    setLoading(true)
    setError(null)
    sendRawRef.current(JSON.stringify({ type: 'rag_list' }))
  }, [])

  const deleteDocument = useCallback((docId: string) => {
    sendRawRef.current?.(JSON.stringify({ type: 'rag_delete', docId }))
  }, [])

  const uploadDocument = useCallback(async (file: File) => {
    if (!sendRawRef.current) return
    setUploading(true)
    setError(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const b64 = result.includes(',') ? result.split(',')[1] : result
          resolve(b64)
        }
        reader.onerror = () => reject(new Error('FileReader failed'))
        reader.readAsDataURL(file)
      })

      const uploadId = `upload_${Date.now()}`
      const chunks: string[] = []
      for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
        chunks.push(base64.slice(i, i + CHUNK_SIZE))
      }

      sendRawRef.current(JSON.stringify({ type: 'rag_upload_start', uploadId, filename: file.name, totalChunks: chunks.length }))
      for (let i = 0; i < chunks.length; i++) {
        sendRawRef.current(JSON.stringify({ type: 'rag_upload_chunk', uploadId, index: i, content: chunks[i] }))
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to read file')
      setUploading(false)
    }
  }, [])

  return { documents, loading, uploading, error, loadDocuments, deleteDocument, uploadDocument }
}
