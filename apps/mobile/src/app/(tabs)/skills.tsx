import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  useSkills,
  Skill,
  CronJob,
} from '../../hooks/useSkills'
import { useConnection } from '../../ConnectionContext'
import { useAgentContext } from '../../AgentContext'
import { colors } from '../../theme'

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily 9am', value: '0 9 * * *' },
  { label: 'Daily 6pm', value: '0 18 * * *' },
  { label: 'Every 6h', value: '0 */6 * * *' },
  { label: 'Mon-Fri 9am', value: '0 9 * * 1-5' },
]

export default function SkillsScreen() {
  const {
    skills,
    jobs,
    loading,
    runResult,
    running,
    error,
    loadAll,
    createSkill,
    updateSkill,
    deleteSkill,
    runSkill,
    createCron,
    toggleCron,
    deleteCron,
    clearRunResult,
  } = useSkills()

  const { rtcState, authState } = useConnection()
  const { activeAgent } = useAgentContext()

  // Skill form
  const [showSkillForm, setShowSkillForm] = useState(false)
  const [editingSkill, setEditingSkill] =
    useState<Skill | null>(null)
  const [sName, setSName] = useState('')
  const [sDesc, setSDesc] = useState('')
  const [sPrompt, setSPrompt] = useState('')

  // Cron form
  const [showCronForm, setShowCronForm] = useState(false)
  const [cronSkillId, setCronSkillId] = useState('')
  const [cronExpr, setCronExpr] = useState('0 9 * * *')

  useFocusEffect(
    useCallback(() => {
      if (authState === 'ready') loadAll()
    }, [authState, loadAll]),
  )

  const openCreate = () => {
    setEditingSkill(null)
    setSName('')
    setSDesc('')
    setSPrompt('')
    setShowSkillForm(true)
  }

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setSName(skill.name)
    setSDesc(skill.description)
    setSPrompt(skill.prompt)
    setShowSkillForm(true)
  }

  const saveSkill = () => {
    if (!sName.trim() || !sPrompt.trim()) return
    if (editingSkill) {
      updateSkill(
        editingSkill.id,
        sName.trim(),
        sPrompt.trim(),
        sDesc.trim(),
      )
    } else {
      createSkill(
        sName.trim(),
        sPrompt.trim(),
        sDesc.trim(),
      )
    }
    setShowSkillForm(false)
  }

  const confirmDelete = (skill: Skill) => {
    Alert.alert('Delete skill', `Remove "${skill.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSkill(skill.id),
      },
    ])
  }

  const openCronForm = (skillId: string) => {
    setCronSkillId(skillId)
    setCronExpr('0 9 * * *')
    setShowCronForm(true)
  }

  const saveCron = () => {
    createCron(cronSkillId, cronExpr)
    setShowCronForm(false)
  }

  const confirmDeleteCron = (job: CronJob) => {
    Alert.alert(
      'Delete job',
      'Remove this scheduled job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCron(job.id),
        },
      ],
    )
  }

  const isReady = authState === 'ready'
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

  const skillJobsOf = (skillId: string) =>
    jobs.filter((j) => j.skillId === skillId)

  return (
    <View style={s.container}>
      {/* Status bar */}
      <View style={s.statusBar}>
        <View
          style={[s.dot, { backgroundColor: statusColor }]}
        />
        <Text style={s.statusText}>{statusText}</Text>
      </View>

      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.list}>
        {loading && (
          <View style={s.progressRow}>
            <ActivityIndicator
              color={colors.accent}
              size="small"
            />
            <Text style={s.progressText}>Loading...</Text>
          </View>
        )}

        {!loading && skills.length === 0 && (
          <Text style={s.emptyText}>
            {isReady
              ? 'No skills yet. Create one below.'
              : 'Connect to manage skills.'}
          </Text>
        )}

        {skills.map((skill) => (
          <View key={skill.id} style={s.skillCard}>
            <View style={s.skillHeader}>
              <View style={s.skillInfo}>
                <Text style={s.skillName}>
                  {skill.name}
                </Text>
                {!!skill.description && (
                  <Text style={s.skillDesc}>
                    {skill.description}
                  </Text>
                )}
              </View>
              <View style={s.skillActions}>
                <TouchableOpacity
                  style={s.actionBtn}
                  onPress={() => runSkill(skill.id)}
                >
                  <Text style={s.actionBtnText}>Run</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnGray]}
                  onPress={() => openEdit(skill)}
                >
                  <Text
                    style={[
                      s.actionBtnText,
                      s.actionBtnTextGray,
                    ]}
                  >
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnRed]}
                  onPress={() => confirmDelete(skill)}
                >
                  <Text
                    style={[
                      s.actionBtnText,
                      s.actionBtnTextRed,
                    ]}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {skillJobsOf(skill.id).map((job) => (
              <View key={job.id} style={s.cronRow}>
                <View style={s.cronInfo}>
                  <Text style={s.cronExpr}>
                    {job.cronExpression}
                  </Text>
                  <Text style={s.cronLast}>
                    Last run:{' '}
                    {job.lastRun
                      ? new Date(
                          job.lastRun,
                        ).toLocaleDateString()
                      : 'Never'}
                  </Text>
                </View>
                <Text style={s.cronEnabledLabel}>
                  Enabled
                </Text>
                <Switch
                  value={job.enabled}
                  onValueChange={() => toggleCron(job)}
                  thumbColor={
                    job.enabled
                      ? colors.accent
                      : colors.textLow
                  }
                  trackColor={{
                    true: colors.accent + '55',
                    false: colors.border,
                  }}
                  style={s.cronSwitch}
                />
                <TouchableOpacity
                  style={s.cronDeleteBtn}
                  onPress={() => confirmDeleteCron(job)}
                >
                  <Text style={s.cronDeleteIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={s.addCronBtn}
              onPress={() => openCronForm(skill.id)}
            >
              <Text style={s.addCronText}>
                + Add schedule
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {isReady && (
        <View style={s.footer}>
          <TouchableOpacity
            style={s.newSkillBtn}
            onPress={openCreate}
          >
            <Text style={s.newSkillText}>+ New Skill</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Run result modal */}
      <Modal
        visible={running || runResult !== null}
        transparent
        animationType="slide"
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Skill Result</Text>
            {running ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginVertical: 24 }}
              />
            ) : (
              <ScrollView style={s.resultScroll}>
                <Text style={s.resultText}>
                  {runResult}
                </Text>
              </ScrollView>
            )}
            {!running && (
              <TouchableOpacity
                style={s.modalClose}
                onPress={clearRunResult}
              >
                <Text style={s.modalCloseText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Skill form modal */}
      <Modal
        visible={showSkillForm}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={
            Platform.OS === 'ios' ? 'padding' : 'height'
          }
        >
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>
              {editingSkill ? 'Edit Skill' : 'New Skill'}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={s.input}
                placeholder="Name"
                placeholderTextColor={colors.textLow}
                value={sName}
                onChangeText={setSName}
              />
              <TextInput
                style={s.input}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textLow}
                value={sDesc}
                onChangeText={setSDesc}
              />
              <TextInput
                style={[s.input, s.inputTall]}
                placeholder="Prompt - what should the agent do?"
                placeholderTextColor={colors.textLow}
                value={sPrompt}
                onChangeText={setSPrompt}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={s.modalButtons}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => setShowSkillForm(false)}
                >
                  <Text style={s.cancelBtnText}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.saveBtn,
                    (!sName || !sPrompt) &&
                      s.saveBtnDisabled,
                  ]}
                  onPress={saveSkill}
                  disabled={!sName || !sPrompt}
                >
                  <Text style={s.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cron form modal */}
      <Modal
        visible={showCronForm}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={
            Platform.OS === 'ios' ? 'padding' : 'height'
          }
        >
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Schedule Skill</Text>
            <Text style={s.cronPresetLabel}>Preset</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.presetRow}
            >
              {CRON_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    s.presetChip,
                    cronExpr === p.value &&
                      s.presetChipActive,
                  ]}
                  onPress={() => setCronExpr(p.value)}
                >
                  <Text
                    style={[
                      s.presetChipText,
                      cronExpr === p.value &&
                        s.presetChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[s.input, { fontFamily: 'monospace' }]}
              placeholder="0 9 * * *"
              placeholderTextColor={colors.textLow}
              value={cronExpr}
              onChangeText={setCronExpr}
            />
            <Text style={s.cronHint}>
              minute hour day month weekday
            </Text>
            <View style={s.modalButtons}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowCronForm(false)}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={saveCron}
              >
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
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
  list: { padding: 12, paddingBottom: 80 },
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
  skillCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  skillInfo: { flex: 1 },
  skillName: {
    color: colors.textHigh,
    fontSize: 15,
    fontWeight: '600',
  },
  skillDesc: {
    color: colors.textLow,
    fontSize: 12,
    marginTop: 2,
  },
  skillActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  actionBtnGray: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnRed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.red,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnTextGray: { color: colors.textMed },
  actionBtnTextRed: { color: colors.red },
  cronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  cronInfo: { flex: 1 },
  cronExpr: {
    color: colors.textMed,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  cronLast: {
    color: colors.textLow,
    fontSize: 10,
    marginTop: 2,
  },
  cronEnabledLabel: { color: colors.textLow, fontSize: 11 },
  cronSwitch: {
    transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }],
  },
  cronDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.red + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cronDeleteIcon: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '700',
  },
  addCronBtn: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  addCronText: { color: colors.accent, fontSize: 12 },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  newSkillBtn: {
    backgroundColor: colors.accent,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  newSkillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    color: colors.textHigh,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  resultScroll: { maxHeight: 300 },
  resultText: {
    color: colors.textHigh,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  modalClose: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: colors.textMed,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    padding: 10,
    color: colors.textHigh,
    fontSize: 14,
    marginBottom: 10,
  },
  inputTall: { height: 100, textAlignVertical: 'top' },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textMed,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  cronPresetLabel: {
    color: colors.textMed,
    fontSize: 12,
    marginBottom: 6,
  },
  presetRow: { marginBottom: 10 },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  presetChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetChipText: { color: colors.textMed, fontSize: 12 },
  presetChipTextActive: { color: '#fff' },
  cronHint: {
    color: colors.textLow,
    fontSize: 11,
    marginTop: -6,
    marginBottom: 10,
  },
})
