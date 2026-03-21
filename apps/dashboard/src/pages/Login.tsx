import React, { useState } from 'react'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
} from '@radix-ui/themes'

export const LoginPage = ({
  onLogin,
}: {
  onLogin: (
    username: string,
    password: string,
  ) => Promise<void>
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(username, password)
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh' }}
    >
      <Box style={{ width: '100%', maxWidth: 400 }}>
        <Card>
          <Heading size="5" mb="4" align="center">
            Nekoni Dashboard
          </Heading>
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <Box>
                <Text
                  size="1"
                  color="gray"
                  mb="1"
                  style={{
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Username
                </Text>
                <TextField.Root
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  placeholder="admin"
                  autoComplete="username"
                />
              </Box>
              <Box>
                <Text
                  size="1"
                  color="gray"
                  mb="1"
                  style={{
                    display: 'block',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Password
                </Text>
                <TextField.Root
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </Box>
              {error && (
                <Text color="red" size="2">
                  {error}
                </Text>
              )}
              <Button
                type="submit"
                disabled={loading}
                style={{ marginTop: 4 }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </Flex>
          </form>
        </Card>
      </Box>
    </Flex>
  )
}
