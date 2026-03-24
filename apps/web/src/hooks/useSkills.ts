import { useState, useEffect, useCallback } from 'react'
import { useConnection } from '../contexts/ConnectionContext'

export interface Skill {
  id: string
  name: string
  prompt: string
  description: string
  createdAt: number
}

export interface CronJob {
  id: string
  skillId: string
  cronExpression: string
  enabled: boolean
  lastRun: number | null
  createdAt: number
}

export const useSkills = () => {
  const { sendRawRef, onSkillMessageRef, authState } = useConnection()
  const [skills, setSkills] = useState<Skill[]>([])
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onSkillMessageRef.current = (msg: any) => {
      if (msg.type === 'skill_list_response') {
        setSkills(msg.skills ?? [])
        setLoading(false)
      } else if (msg.type === 'skill_response') {
        setSkills((prev) => {
          const idx = prev.findIndex((s) => s.id === msg.skill.id)
          if (idx >= 0) { const next = [...prev]; next[idx] = msg.skill; return next }
          return [...prev, msg.skill]
        })
      } else if (msg.type === 'skill_delete_response') {
        setSkills((prev) => prev.filter((s) => s.id !== msg.id))
      } else if (msg.type === 'skill_run_response') {
        setRunResult(msg.result ?? '')
        setRunning(false)
      } else if (msg.type === 'cron_list_response') {
        setJobs(msg.jobs ?? [])
      } else if (msg.type === 'cron_response') {
        setJobs((prev) => {
          const idx = prev.findIndex((j) => j.id === msg.job.id)
          if (idx >= 0) { const next = [...prev]; next[idx] = msg.job; return next }
          return [...prev, msg.job]
        })
      } else if (msg.type === 'cron_delete_response') {
        setJobs((prev) => prev.filter((j) => j.id !== msg.id))
      } else if (msg.type === 'skill_error') {
        setError(msg.message ?? 'Unknown error')
        setLoading(false)
        setRunning(false)
      }
    }
    return () => { onSkillMessageRef.current = null }
  }, [])

  useEffect(() => {
    if (authState !== 'ready') { setLoading(false); setRunning(false) }
  }, [authState])

  const send = useCallback((obj: object) => sendRawRef.current?.(JSON.stringify(obj)), [])

  const loadAll = useCallback(() => {
    setLoading(true)
    setError(null)
    send({ type: 'skill_list' })
    send({ type: 'cron_list' })
  }, [send])

  const createSkill = useCallback((name: string, prompt: string, description: string) => {
    send({ type: 'skill_create', name, prompt, description })
  }, [send])

  const updateSkill = useCallback((id: string, name: string, prompt: string, description: string) => {
    send({ type: 'skill_update', id, name, prompt, description })
  }, [send])

  const deleteSkill = useCallback((id: string) => { send({ type: 'skill_delete', id }) }, [send])

  const runSkill = useCallback((id: string) => {
    setRunning(true)
    setRunResult(null)
    setError(null)
    send({ type: 'skill_run', id })
  }, [send])

  const createCron = useCallback((skillId: string, cronExpression: string) => {
    send({ type: 'cron_create', skillId, cronExpression, enabled: true })
  }, [send])

  const toggleCron = useCallback((job: CronJob) => {
    send({ type: 'cron_update', id: job.id, enabled: !job.enabled })
  }, [send])

  const deleteCron = useCallback((id: string) => { send({ type: 'cron_delete', id }) }, [send])

  return {
    skills, jobs, loading, runResult, running, error,
    loadAll, createSkill, updateSkill, deleteSkill, runSkill,
    createCron, toggleCron, deleteCron,
    clearRunResult: () => setRunResult(null),
  }
}
