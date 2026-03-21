import React, { useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { useRAG } from '../../hooks/useRAG'
import { useConnection } from '../../ConnectionContext'
import { useAgentContext } from '../../AgentContext'
import { colors } from '../../theme'

export default function KnowledgeScreen() {
  const {
    documents,
    loading,
    uploading,
    error,
    loadDocuments,
    deleteDocument,
    uploadDocument,
  } = useRAG()

  const { rtcState, authState } = useConnection()
  const { activeAgent } = useAgentContext()

  useFocusEffect(
    useCallback(() => {
      if (authState === 'ready') loadDocuments()
    }, [authState, loadDocuments]),
  )

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'text/markdown', 'text/csv'],
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    const asset = result.assets[0]
    await uploadDocument(asset.uri, asset.name)
  }

  const handleDelete = (docId: string, source: string) => {
    Alert.alert(
      'Delete document',
      `Remove "${source}" from the knowledge base?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDocument(docId),
        },
      ],
    )
  }

  const statusColor =
    rtcState === 'connected' ? colors.green : colors.red

  const statusText =
    rtcState === 'connected'
      ? authState === 'ready'
        ? (activeAgent?.agentName ?? 'Connected')
        : 'Authenticating...'
      : rtcState === 'connecting'
        ? 'Connecting...'
        : rtcState === 'disconnected'
          ? 'Disconnected'
          : 'Not connected'

  const isReady = authState === 'ready'

  return (
    <View style={styles.container}>
      {/* Status bar — same as chat tab */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={documents}
        keyExtractor={(item) => item.doc_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>
              {isReady
                ? 'No documents in the knowledge base.'
                : 'Connect to your agent to manage the knowledge base.'}
            </Text>
          )
        }
        ListHeaderComponent={
          loading || uploading ? (
            <View style={styles.progressRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.progressText}>
                {uploading ? 'Uploading…' : 'Loading…'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.sourceName} numberOfLines={1}>
                {item.source || item.doc_id}
              </Text>
              <Text style={styles.chunkCount}>
                {item.chunks} chunk{item.chunks !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.doc_id, item.source)}
            >
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.uploadBtn,
            (!isReady || uploading) && styles.uploadBtnDisabled,
          ]}
          onPress={handleUpload}
          disabled={!isReady || uploading}
        >
          <Text style={styles.uploadBtnText}>
            {uploading ? 'Uploading…' : '+ Upload Document'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: {
    color: colors.textMed,
    fontSize: 13,
    flex: 1,
  },
  errorBanner: {
    backgroundColor: colors.red + '22',
    borderBottomWidth: 1,
    borderBottomColor: colors.red,
    padding: 10,
  },
  errorText: { color: colors.red, fontSize: 13 },
  list: { padding: 12, flexGrow: 1 },
  emptyText: {
    color: colors.textLow,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  progressText: { color: colors.textMed, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  rowInfo: { flex: 1 },
  sourceName: {
    color: colors.textHigh,
    fontSize: 14,
    fontWeight: '500',
  },
  chunkCount: {
    color: colors.textLow,
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.red,
  },
  deleteBtnText: { color: colors.red, fontSize: 12 },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  uploadBtn: {
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.4 },
  uploadBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
})
