import React, { useEffect, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Flex,
  Heading,
  Separator,
  Text,
} from '@radix-ui/themes'
import { apiFetch } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface HealthData {
  status: string
  ts: number
  agent: string
}

interface Tool {
  name: string
  description: string
}

interface ApprovedDevice {
  mobilePubKey: string
  deviceName?: string
  approvedAt: number
}

export const MonitorPage = () => {
  const [health, setHealth] = useState<HealthData | null>(
    null,
  )
  const [tools, setTools] = useState<Tool[]>([])
  const [devices, setDevices] = useState<ApprovedDevice[]>(
    [],
  )
  const [error, setError] = useState('')
  const [confirmDevice, setConfirmDevice] = useState<string | null>(null)

  const fetchAll = async () => {
    try {
      const [hRes, tRes, dRes] = await Promise.all([
        apiFetch('/health'),
        apiFetch('/api/tools'),
        apiFetch('/api/pair/devices'),
      ])
      if (hRes.ok) {
        setHealth(await hRes.json())
        setError('')
      } else {
        setError(`Agent returned HTTP ${hRes.status}`)
      }
      if (tRes.ok) setTools(await tRes.json())
      if (dRes.ok) setDevices(await dRes.json())
    } catch {
      setError('Agent not reachable')
    }
  }

  const revokeDevice = async (mobilePubKey: string) => {
    await apiFetch(
      `/api/pair/devices/${encodeURIComponent(mobilePubKey)}`,
      { method: 'DELETE' },
    )
    fetchAll()
  }

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <Box>
      <Heading size="5" mb="4">
        Agent Monitor
      </Heading>

      <Card mb="4">
        <Heading size="3" color="gray" mb="3">
          Health
        </Heading>
        {error && (
          <Text
            color="red"
            mb="2"
            style={{ display: 'block' }}
          >
            Error: {error}
          </Text>
        )}
        {health ? (
          <Flex gap="6">
            <Box>
              <Text
                size="1"
                color="gray"
                style={{
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
                mb="1"
              >
                Status
              </Text>
              <Badge
                color={
                  health.status === 'ok' ? 'green' : 'red'
                }
              >
                {health.status}
              </Badge>
            </Box>
            <Box>
              <Text
                size="1"
                color="gray"
                style={{
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
                mb="1"
              >
                Agent
              </Text>
              <Text>{health.agent}</Text>
            </Box>
            <Box>
              <Text
                size="1"
                color="gray"
                style={{
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
                mb="1"
              >
                Last Check
              </Text>
              <Text>
                {new Date(health.ts).toLocaleTimeString()}
              </Text>
            </Box>
          </Flex>
        ) : (
          <Text color="gray">Checking...</Text>
        )}
      </Card>

      <Card mb="4">
        <Heading size="3" color="gray" mb="3">
          Available Tools ({tools.length})
        </Heading>
        {tools.map((t, i) => (
          <Box key={t.name}>
            {i > 0 && <Separator size="4" my="2" />}
            <Flex align="center" gap="2">
              <Badge color="yellow">{t.name}</Badge>
              <Text size="2" color="gray">
                {t.description}
              </Text>
            </Flex>
          </Box>
        ))}
      </Card>

      <Card>
        <Heading size="3" color="gray" mb="3">
          Approved Devices ({devices.length})
        </Heading>
        {devices.length === 0 ? (
          <Text color="gray" size="2">
            No approved devices
          </Text>
        ) : (
          devices.map((d, i) => (
            <Box key={d.mobilePubKey}>
              {i > 0 && <Separator size="4" my="2" />}
              <Flex justify="between" align="center">
                <Box>
                  <Text
                    size="2"
                    style={{ display: 'block' }}
                    mb="1"
                  >
                    {d.deviceName || 'Unknown device'}
                  </Text>
                  <Code size="1">
                    {d.mobilePubKey.slice(0, 32)}…
                  </Code>
                </Box>
                <Button
                  color="red"
                  variant="soft"
                  size="1"
                  onClick={() => setConfirmDevice(d.mobilePubKey)}
                >
                  Revoke
                </Button>
              </Flex>
            </Box>
          ))
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDevice}
        title="Revoke Device"
        description="This will disconnect the device and remove its pairing. It will need to be paired again to reconnect."
        confirmLabel="Revoke"
        onConfirm={() => { revokeDevice(confirmDevice!); setConfirmDevice(null) }}
        onCancel={() => setConfirmDevice(null)}
      />
    </Box>
  )
}
