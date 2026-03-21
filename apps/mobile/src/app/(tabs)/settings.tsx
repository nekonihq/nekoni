import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useIdentity } from '../../hooks/useIdentity'
import { useConnection } from '../../ConnectionContext'
import { useAgentContext, AgentInfo } from '../../AgentContext'
import { colors } from '../../theme'

export default function SettingsScreen() {
  const router = useRouter()
  const { identity } = useIdentity()
  const { disconnectRef } = useConnection()
  const {
    agents,
    activeAgentId,
    selectAgent,
    removeAgent,
  } = useAgentContext()

  const agentList = Object.values(agents)

  const handleConnect = async (agent: AgentInfo) => {
    disconnectRef.current?.()
    await selectAgent(agent.roomId)
    router.push('/')
  }

  const handleReconnect = () => {
    disconnectRef.current?.()
    router.push('/')
  }

  const handleUnpair = (agent: AgentInfo) => {
    Alert.alert(
      'Unpair Agent',
      `Remove "${agent.agentName}"?`,
      [
        { text: 'Cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            if (activeAgentId === agent.roomId) {
              disconnectRef.current?.()
            }
            await removeAgent(agent.roomId)
          },
        },
      ],
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Device Identity
        </Text>
        <View style={styles.card}>
          <Text style={styles.label}>Public Key</Text>
          <Text style={styles.value} selectable>
            {identity?.publicKeyB64 ?? 'Loading...'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Paired Agents
        </Text>
        {agentList.length === 0 ? (
          <Text style={styles.emptyText}>
            No agents paired yet
          </Text>
        ) : (
          agentList.map((agent) => {
            const isActive = agent.roomId === activeAgentId
            return (
              <View key={agent.roomId} style={styles.card}>
                <View style={styles.agentHeader}>
                  <View style={styles.agentNameRow}>
                    {isActive && (
                      <View style={styles.activeDot} />
                    )}
                    <Text style={styles.agentName}>
                      {agent.agentName}
                    </Text>
                  </View>
                  {isActive && (
                    <Text style={styles.activeLabel}>
                      active
                    </Text>
                  )}
                </View>
                <Text style={styles.label}>Room ID</Text>
                <Text style={styles.value} selectable>
                  {agent.roomId}
                </Text>
                <Text style={styles.label}>Signal URL</Text>
                <Text style={styles.value} selectable>
                  {agent.signalUrl}
                </Text>
                <View style={styles.agentActions}>
                  {isActive ? (
                    <TouchableOpacity
                      style={styles.connectBtn}
                      onPress={handleReconnect}
                    >
                      <Text style={styles.connectBtnText}>
                        Reconnect
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectBtn}
                      onPress={() => handleConnect(agent)}
                    >
                      <Text style={styles.connectBtnText}>
                        Connect
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={() => handleUnpair(agent)}
                  >
                    <Text style={styles.dangerBtnText}>
                      Unpair
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/pair')}
        >
          <Text style={styles.addBtnText}>
            + Add Agent
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: colors.textMed,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  agentName: {
    color: colors.textHigh,
    fontSize: 15,
    fontWeight: '600',
  },
  activeLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    color: colors.textLow,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 2,
  },
  value: {
    color: colors.textHigh,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  agentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  connectBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  dangerBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  dangerBtnText: { color: colors.red, fontWeight: '600' },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyText: {
    color: colors.textLow,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
})
