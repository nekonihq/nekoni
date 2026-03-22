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
import { QRCodeSVG } from 'qrcode.react'
import { apiFetch } from '../api'

interface QRPayload {
  agentPubKey: string
  signalUrl: string
  roomId: string
  agentName: string
}

interface PendingDevice {
  mobilePubKey: string
  deviceName?: string
  ts: number
}

export const PairPage = () => {
  const [qrData, setQrData] = useState<QRPayload | null>(
    null,
  )
  const [pending, setPending] = useState<PendingDevice[]>(
    [],
  )
  const [error, setError] = useState('')

  const fetchQR = async () => {
    try {
      const res = await apiFetch('/api/qr')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setQrData(await res.json())
    } catch (e: any) {
      setError(e.message)
    }
  }

  const fetchPending = async () => {
    try {
      const res = await apiFetch('/api/pair/pending')
      if (res.ok) setPending(await res.json())
    } catch {}
  }

  const approve = async (
    mobilePubKey: string,
    approved: boolean,
  ) => {
    await apiFetch('/api/pair/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobilePubKey, approved }),
    })
    fetchPending()
  }

  useEffect(() => {
    fetchQR()
    fetchPending()
    const t = setInterval(fetchPending, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <Box>
      <Heading size="5" mb="4">
        Pair Mobile Device
      </Heading>

      <Card mb="4">
        <Flex gap="6" align="start">
          <Box>
            {qrData ? (
              <QRCodeSVG
                value={JSON.stringify(qrData)}
                size={220}
                bgColor="#161b22"
                fgColor="#e6edf3"
              />
            ) : error ? (
              <Text color="red">
                Agent not reachable: {error}
              </Text>
            ) : (
              <Text color="gray">Loading QR code...</Text>
            )}
          </Box>

          {qrData && (
            <Box style={{ fontSize: '0.8rem' }}>
              <Flex direction="column" gap="2">
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
                  <Text size="2">{qrData.agentName}</Text>
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
                    Room
                  </Text>
                  <Code size="2">{qrData.roomId}</Code>
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
                    Signal
                  </Text>
                  <Code size="2">{qrData.signalUrl}</Code>
                </Box>
                <Box style={{ wordBreak: 'break-all' }}>
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
                    Pub Key
                  </Text>
                  <Code size="2">{qrData.agentPubKey}</Code>
                </Box>
                <Box mt="2">
                  <Button
                    variant="soft"
                    size="2"
                    onClick={fetchQR}
                  >
                    Refresh
                  </Button>
                </Box>
              </Flex>
            </Box>
          )}
        </Flex>
      </Card>

      {pending.length > 0 && (
        <Card>
          <Heading size="3" color="gray" mb="3">
            Pending Pairing Requests
          </Heading>
          {pending.map((d, i) => (
            <Box key={d.mobilePubKey}>
              {i > 0 && <Separator size="4" my="2" />}
              <Flex justify="between" align="center">
                <Box>
                  <Text
                    size="2"
                    style={{ display: 'block' }}
                  >
                    {d.deviceName || 'Unknown device'}
                  </Text>
                  <Code
                    size="1"
                    style={{ wordBreak: 'break-all' }}
                  >
                    {d.mobilePubKey}
                  </Code>
                </Box>
                <Flex gap="2">
                  <Button
                    color="green"
                    variant="soft"
                    onClick={() =>
                      approve(d.mobilePubKey, true)
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    color="red"
                    variant="soft"
                    onClick={() =>
                      approve(d.mobilePubKey, false)
                    }
                  >
                    Reject
                  </Button>
                </Flex>
              </Flex>
            </Box>
          ))}
        </Card>
      )}
    </Box>
  )
}
