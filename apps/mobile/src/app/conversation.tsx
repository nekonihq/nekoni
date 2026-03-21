import React from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getMessages, MessageRow } from '../db'
import { colors } from '../theme'

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const messages = id ? getMessages(id) : []

  const renderItem = ({ item }: { item: MessageRow }) => (
    <View
      style={[
        styles.bubble,
        item.role === 'user'
          ? styles.userBubble
          : styles.agentBubble,
      ]}
    >
      <Text style={styles.bubbleText}>{item.content}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 12, flexGrow: 1 },
  empty: {
    color: colors.textLow,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.textHigh, fontSize: 15 },
  timestamp: {
    color: colors.textLow,
    fontSize: 10,
    marginTop: 4,
  },
})
