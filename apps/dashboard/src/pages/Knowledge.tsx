import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  Table,
  Text,
} from '@radix-ui/themes'
import { apiFetch } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface RagDocument {
  doc_id: string
  source: string
  chunks: number
}

export const KnowledgePage = () => {
  const [docs, setDocs] = useState<RagDocument[]>([])
  const [confirmDocId, setConfirmDocId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<
    string | null
  >(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadDocs = () => {
    apiFetch('/api/rag/documents')
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => {})
  }

  useEffect(() => {
    loadDocs()
  }, [])

  const uploadFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('/api/ingest', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          body.detail ?? `Upload failed (${res.status})`,
        )
      }
      loadDocs()
    } catch (e: any) {
      setUploadError(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(uploadFile)
  }

  const handleDelete = async (docId: string) => {
    await apiFetch(
      `/api/rag/documents/${encodeURIComponent(docId)}`,
      {
        method: 'DELETE',
      },
    )
    setDocs((prev) =>
      prev.filter((d) => d.doc_id !== docId),
    )
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Text size="5" weight="bold">
          Knowledge Base
        </Text>
        <Flex align="center" gap="2">
          <Badge color="gray">
            {docs.length} document
            {docs.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="soft"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : '+ Upload'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Flex>
      </Flex>

      {uploadError && (
        <Box
          mb="3"
          p="3"
          style={{
            background: 'var(--red-3)',
            borderRadius: 6,
            border: '1px solid var(--red-6)',
          }}
        >
          <Text color="red" size="2">
            {uploadError}
          </Text>
        </Box>
      )}

      {/* Drop zone */}
      <Box
        mb="4"
        p="5"
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-9)' : 'var(--gray-6)'}`,
          borderRadius: 8,
          textAlign: 'center',
          background: dragOver
            ? 'var(--accent-2)'
            : 'var(--gray-2)',
          transition: 'all 0.15s',
          cursor: 'pointer',
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Text color="gray" size="2">
          {uploading
            ? 'Uploading…'
            : 'Drop files here or click to upload (.txt, .md, .pdf, .csv)'}
        </Text>
      </Box>

      {docs.length === 0 ? (
        <Text
          color="gray"
          style={{
            display: 'block',
            textAlign: 'center',
            paddingTop: '2rem',
          }}
        >
          No documents ingested yet.
        </Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                Source
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                Doc ID
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                Chunks
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {docs.map((doc) => (
              <Table.Row key={doc.doc_id}>
                <Table.Cell>
                  <Text style={{ fontFamily: 'monospace' }}>
                    {doc.source || '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text
                    color="gray"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                    }}
                  >
                    {doc.doc_id}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color="jade">{doc.chunks}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Flex justify="end">
                    <Button
                      size="1"
                      variant="soft"
                      color="red"
                      onClick={() => setConfirmDocId(doc.doc_id)}
                    >
                      Delete
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      <ConfirmDialog
        open={!!confirmDocId}
        title="Delete Document"
        description="Remove this document from the knowledge base? This cannot be undone."
        onConfirm={() => { handleDelete(confirmDocId!); setConfirmDocId(null) }}
        onCancel={() => setConfirmDocId(null)}
      />
    </Box>
  )
}
