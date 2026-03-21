import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import Toast from 'react-native-toast-message'
import { colors } from '../theme'
import { ConnectionProvider } from '../ConnectionContext'
import { AgentProvider } from '../AgentContext'
import { toastConfig } from '../components/ToastConfig'

export default function RootLayout() {
  return (
    <AgentProvider>
      <ConnectionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.textHigh,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="pair"
            options={{
              title: 'Pair Device',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="history"
            options={{
              title: 'History',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="conversation"
            options={{
              title: 'Conversation',
              headerBackTitle: 'Back',
            }}
          />
        </Stack>
      </ConnectionProvider>
      <Toast config={toastConfig} />
    </AgentProvider>
  )
}
