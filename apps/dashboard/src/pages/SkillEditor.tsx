import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Flex,
  Text,
  TextField,
} from '@radix-ui/themes'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { apiFetch } from '../api'

export const SkillEditorPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    apiFetch(`/api/skills`)
      .then((r) => r.json())
      .then((skills: any[]) => {
        const skill = skills.find((s) => s.id === id)
        if (skill) {
          setName(skill.name)
          setDescription(skill.description ?? '')
          setPrompt(skill.prompt)
        }
      })
  }, [id])

  const save = async () => {
    if (!name.trim() || !prompt.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        await apiFetch('/api/skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            prompt: prompt.trim(),
            description: description.trim(),
          }),
        })
      } else {
        await apiFetch(`/api/skills/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            prompt: prompt.trim(),
            description: description.trim(),
          }),
        })
      }
      navigate('/skills')
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box data-color-mode="dark">
      <Flex align="center" gap="3" mb="4">
        <Button
          variant="ghost"
          color="gray"
          onClick={() => navigate('/skills')}
        >
          ← Skills
        </Button>
        <Text size="5" weight="bold">
          {isNew ? 'New Skill' : 'Edit Skill'}
        </Text>
      </Flex>

      <Flex
        direction="column"
        gap="3"
        mb="4"
        style={{ maxWidth: 600 }}
      >
        <Box>
          <Text
            size="1"
            color="gray"
            mb="1"
            style={{ display: 'block' }}
          >
            Name
          </Text>
          <TextField.Root
            placeholder="e.g. Daily Standup Summary"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Box>
        <Box>
          <Text
            size="1"
            color="gray"
            mb="1"
            style={{ display: 'block' }}
          >
            Description <Text color="gray">(optional)</Text>
          </Text>
          <TextField.Root
            placeholder="Short description shown in the skill list"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Box>
      </Flex>

      <Box mb="4">
        <Text
          size="1"
          color="gray"
          mb="1"
          style={{ display: 'block' }}
        >
          Prompt
        </Text>
        <MDEditor
          value={prompt}
          onChange={(v) => setPrompt(v ?? '')}
          height={480}
          preview="live"
          style={
            {
              '--color-accent-fg': '#30a46c',
              '--color-accent-emphasis': '#299764',
              '--color-prettylights-syntax-markup-heading':
                '#30a46c',
            } as React.CSSProperties
          }
          commands={commands
            .getCommands()
            .filter((c) => c.name !== 'image')}
          previewOptions={{
            components: { img: () => null },
          }}
        />
        <Text
          size="1"
          color="gray"
          mt="1"
          style={{ display: 'block' }}
        >
          Supports markdown. The agent will execute this
          prompt when the skill is triggered.
        </Text>
      </Box>

      {error && (
        <Text
          color="red"
          size="2"
          mb="3"
          style={{ display: 'block' }}
        >
          {error}
        </Text>
      )}

      <Flex gap="2">
        <Button
          variant="soft"
          color="gray"
          onClick={() => navigate('/skills')}
        >
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={
            !name.trim() || !prompt.trim() || saving
          }
        >
          {saving ? 'Saving…' : 'Save Skill'}
        </Button>
      </Flex>
    </Box>
  )
}
