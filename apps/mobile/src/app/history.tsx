import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAgentContext } from '../AgentContext'
import { useAgent, ChatMessage } from '../hooks/useAgent'
import {
  getConversations,
  getMessages,
  deleteConversation,
  ConversationRow,
} from '../db'
import { colors } from '../theme'

const formatDate = (ts: number): string => {
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / 86_400_000,
  )
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function HistoryScreen() {
  const router = useRouter()
  const { activeAgent } = useAgentContext()
  const [conversations, setConversations] = useState<
    ConversationRow[]
  >([])

  useFocusEffect(
    useCallback(() => {
      if (activeAgent) {
        setConversations(getConversations(activeAgent.roomId))
      }
    }, [activeAgent?.roomId]),
  )

  const handleLoad = (conv: ConversationRow) => {
    router.push({
      pathname: '/conversation',
      params: { id: conv.id },
    })
  }

  const handleDelete = (conv: ConversationRow) => {
    Alert.alert(
      'Delete conversation',
      conv.title
        ? `"${conv.title}"`
        : 'This conversation will be deleted.',
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteConversation(conv.id)
            setConversations((prev) =>
              prev.filter((c) => c.id !== conv.id),
            )
          },
        },
      ],
    )
  }

  const renderItem = ({ item }: { item: ConversationRow }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => handleLoad(item)}
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.rowMain}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title ?? 'New conversation'}
        </Text>
        <Text style={styles.date}>
          {formatDate(item.updated_at)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No conversations yet
          </Text>
        }
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowMain: { flex: 1 },
  title: {
    color: colors.textHigh,
    fontSize: 15,
    marginBottom: 3,
  },
  date: {
    color: colors.textLow,
    fontSize: 12,
  },
  deleteBtn: {
    paddingLeft: 12,
  },
  deleteBtnText: {
    color: colors.textLow,
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  empty: {
    color: colors.textLow,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
})
