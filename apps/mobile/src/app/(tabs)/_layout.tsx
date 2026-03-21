import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const icon =
  (active: IoniconsName, inactive: IoniconsName) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  )

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textLow,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textHigh,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: icon('chatbubble', 'chatbubble-outline'),
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: 'Knowledge',
          tabBarIcon: icon('book', 'book-outline'),
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          title: 'Skills',
          tabBarIcon: icon('flash', 'flash-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: icon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  )
}
