import React, { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Text,
} from '@radix-ui/themes'
import MDEditor, { commands } from '@uiw/react-md-editor'
import { apiFetch } from '../api'

export const SettingsPage = () => {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/settings/system-prompt')
      .then((r) => r.json())
      .then((data: { prompt: string }) => setPrompt(data.prompt))
      .catch((e) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await apiFetch('/api/settings/system-prompt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box data-color-mode="dark">
      <Text size="5" weight="bold" mb="4" style={{ display: 'block' }}>
        Settings
      </Text>

      <Box mb="2">
        <Text size="2" weight="medium" mb="1" style={{ display: 'block' }}>
          System Prompt
        </Text>
        <Text size="1" color="gray" mb="3" style={{ display: 'block' }}>
          Defines the agent's persona and instructions. Use{' '}
          <code style={{ fontFamily: 'monospace' }}>{'{tools_json}'}</code> as a
          placeholder — it will be replaced with the available tools at runtime.
        </Text>
      </Box>

      {loading ? (
        <Text size="2" color="gray">
          Loading…
        </Text>
      ) : (
        <>
          <Box mb="4">
            <MDEditor
              value={prompt}
              onChange={(v) => setPrompt(v ?? '')}
              height={520}
              preview="edit"
              style={
                {
                  '--color-accent-fg': '#30a46c',
                  '--color-accent-emphasis': '#299764',
                  '--color-prettylights-syntax-markup-heading': '#30a46c',
                } as React.CSSProperties
              }
              commands={commands
                .getCommands()
                .filter((c) => c.name !== 'image')}
            />
          </Box>

          {error && (
            <Text color="red" size="2" mb="3" style={{ display: 'block' }}>
              {error}
            </Text>
          )}

          <Flex gap="2" align="center">
            <Button onClick={save} disabled={saving || !prompt.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            {saved && (
              <Text size="2" color="jade">
                Saved
              </Text>
            )}
          </Flex>
        </>
      )}
    </Box>
  )
}
