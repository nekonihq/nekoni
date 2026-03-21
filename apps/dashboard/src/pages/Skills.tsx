import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Select,
  Switch,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { apiFetch } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface Skill {
  id: string
  name: string
  prompt: string
  description: string
  createdAt: number
}

interface CronJob {
  id: string
  skillId: string
  cronExpression: string
  enabled: boolean
  lastRun: number | null
  createdAt: number
}

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Daily at 6pm', value: '0 18 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Mon–Fri at 9am', value: '0 9 * * 1-5' },
  { label: 'Weekly (Mon 9am)', value: '0 9 * * 1' },
]

export const SkillsPage = () => {
  const navigate = useNavigate()
  const [skills, setSkills] = useState<Skill[]>([])
  const [jobs, setJobs] = useState<CronJob[]>([])

  // Cron form state
  const [cronDialog, setCronDialog] = useState(false)
  const [cronSkillId, setCronSkillId] = useState('')
  const [cronExpr, setCronExpr] = useState('0 9 * * *')

  // Confirm delete state
  const [confirmSkill, setConfirmSkill] = useState<Skill | null>(null)
  const [confirmCronId, setConfirmCronId] = useState<string | null>(null)

  // Run result state
  const [runDialog, setRunDialog] = useState(false)
  const [runResult, setRunResult] = useState('')
  const [running, setRunning] = useState(false)

  const load = async () => {
    const [s, j] = await Promise.all([
      apiFetch('/api/skills').then((r) => r.json()),
      apiFetch('/api/cron').then((r) => r.json()),
    ])
    setSkills(s)
    setJobs(j)
  }

  useEffect(() => {
    load()
  }, [])

  const deleteSkill = async (id: string) => {
    await apiFetch(`/api/skills/${id}`, {
      method: 'DELETE',
    })
    load()
  }

  const runSkill = async (skill: Skill) => {
    setRunResult('Running…')
    setRunDialog(true)
    setRunning(true)
    try {
      const res = await apiFetch(
        `/api/skills/${skill.id}/run`,
        { method: 'POST' },
      )
      const data = await res.json()
      setRunResult(data.result ?? JSON.stringify(data))
    } catch (e: any) {
      setRunResult(`Error: ${e.message}`)
    } finally {
      setRunning(false)
    }
  }

  const saveCron = async () => {
    await apiFetch('/api/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId: cronSkillId,
        cronExpression: cronExpr,
        enabled: true,
      }),
    })
    setCronDialog(false)
    load()
  }

  const toggleCron = async (job: CronJob) => {
    await apiFetch(`/api/cron/${job.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !job.enabled }),
    })
    load()
  }

  const deleteCron = async (id: string) => {
    await apiFetch(`/api/cron/${id}`, { method: 'DELETE' })
    load()
  }

  const skillName = (id: string) =>
    skills.find((s) => s.id === id)?.name ?? id.slice(0, 8)

  return (
    <Box>
      {/* Skills section */}
      <Flex justify="between" align="center" mb="3">
        <Text size="5" weight="bold">
          Skills
        </Text>
        <Button onClick={() => navigate('/skills/new')}>
          + New Skill
        </Button>
      </Flex>

      {skills.length === 0 ? (
        <Text
          color="gray"
          size="2"
          style={{ display: 'block', marginBottom: '2rem' }}
        >
          No skills yet. Create one to get started.
        </Text>
      ) : (
        <Table.Root variant="surface" mb="5">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                Name
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                Description
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {skills.map((skill) => (
              <Table.Row key={skill.id}>
                <Table.Cell>
                  <Text weight="medium">{skill.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text color="gray" size="2">
                    {skill.description || '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2" justify="end">
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => runSkill(skill)}
                    >
                      Run
                    </Button>
                    <Button
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() =>
                        navigate(`/skills/${skill.id}`)
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="1"
                      variant="soft"
                      color="red"
                      onClick={() => setConfirmSkill(skill)}
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

      {/* Cron jobs section */}
      <Flex justify="between" align="center" mb="3">
        <Text size="5" weight="bold">
          Scheduled Jobs
        </Text>
        <Button
          onClick={() => {
            setCronSkillId(skills[0]?.id ?? '')
            setCronExpr('0 9 * * *')
            setCronDialog(true)
          }}
          disabled={skills.length === 0}
        >
          + New Job
        </Button>
      </Flex>

      {jobs.length === 0 ? (
        <Text color="gray" size="2">
          No scheduled jobs.
        </Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>
                Skill
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                Schedule
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                Last Run
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>
                Enabled
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {jobs.map((job) => (
              <Table.Row key={job.id}>
                <Table.Cell>
                  <Badge color="jade">
                    {skillName(job.skillId)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text style={{ fontFamily: 'monospace' }}>
                    {job.cronExpression}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text color="gray" size="2">
                    {job.lastRun
                      ? new Date(
                          job.lastRun,
                        ).toLocaleString()
                      : 'Never'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Switch
                    checked={job.enabled}
                    onCheckedChange={() => toggleCron(job)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Flex justify="end">
                    <Button
                      size="1"
                      variant="soft"
                      color="red"
                      onClick={() => setConfirmCronId(job.id)}
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

      {/* Cron create dialog */}
      <Dialog.Root
        open={cronDialog}
        onOpenChange={setCronDialog}
      >
        <Dialog.Content style={{ maxWidth: 420 }}>
          <Dialog.Title>New Scheduled Job</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <Select.Root
              value={cronSkillId}
              onValueChange={setCronSkillId}
            >
              <Select.Trigger placeholder="Select skill" />
              <Select.Content>
                {skills.map((s) => (
                  <Select.Item key={s.id} value={s.id}>
                    {s.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Select.Root
              value={cronExpr}
              onValueChange={setCronExpr}
            >
              <Select.Trigger placeholder="Preset schedule" />
              <Select.Content>
                {CRON_PRESETS.map((p) => (
                  <Select.Item
                    key={p.value}
                    value={p.value}
                  >
                    {p.label}
                  </Select.Item>
                ))}
                <Select.Item value="custom">
                  Custom…
                </Select.Item>
              </Select.Content>
            </Select.Root>
            <TextField.Root
              placeholder="Cron expression (e.g. 0 9 * * *)"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
            <Text size="1" color="gray">
              Format: minute hour day month weekday
            </Text>
          </Flex>
          <Flex gap="2" justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={saveCron}
              disabled={!cronSkillId || !cronExpr}
            >
              Save
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <ConfirmDialog
        open={!!confirmSkill}
        title="Delete Skill"
        description={`Remove "${confirmSkill?.name}"? Any scheduled jobs for this skill will also be deleted.`}
        onConfirm={() => { deleteSkill(confirmSkill!.id); setConfirmSkill(null) }}
        onCancel={() => setConfirmSkill(null)}
      />

      <ConfirmDialog
        open={!!confirmCronId}
        title="Delete Scheduled Job"
        description="Remove this scheduled job?"
        onConfirm={() => { deleteCron(confirmCronId!); setConfirmCronId(null) }}
        onCancel={() => setConfirmCronId(null)}
      />

      {/* Run result dialog */}
      <Dialog.Root
        open={runDialog}
        onOpenChange={setRunDialog}
      >
        <Dialog.Content style={{ maxWidth: 600 }}>
          <Dialog.Title>Skill Result</Dialog.Title>
          <Box
            mt="3"
            p="3"
            style={{
              background: 'var(--gray-2)',
              borderRadius: 6,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            <Text
              size="2"
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
              }}
            >
              {runResult}
            </Text>
          </Box>
          <Flex justify="end" mt="3">
            <Dialog.Close>
              <Button variant="soft">Close</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  )
}
