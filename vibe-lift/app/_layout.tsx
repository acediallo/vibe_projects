import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { WorkoutProvider } from '@/context/WorkoutContext'
import { theme } from '@/lib/theme'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaProvider>
        <WorkoutProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="workout/active"
              options={{ title: 'Workout', presentation: 'modal' }}
            />
            <Stack.Screen
              name="workout/picker"
              options={{ title: 'Add exercise', presentation: 'modal' }}
            />
            <Stack.Screen name="history/[id]" options={{ title: 'Workout' }} />
            <Stack.Screen name="exercises/new" options={{ title: 'New exercise', presentation: 'modal' }} />
          </Stack>
        </WorkoutProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
