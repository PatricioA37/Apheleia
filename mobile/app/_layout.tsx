import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { color, type } from '@/theme/tokens';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.accent,
          headerTitleStyle: { color: color.ink, fontSize: type.heading, fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color.bg },
          headerBackTitle: 'Inicio',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="medicamentos" options={{ title: 'Medicamentos' }} />
        <Stack.Screen name="controles" options={{ title: 'Controles' }} />
        <Stack.Screen name="plan" options={{ title: 'Mi plan' }} />
        <Stack.Screen name="chat" options={{ title: 'Conversar' }} />
        <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
      </Stack>
      {/* Paleta clara fija: la barra de estado va siempre en oscuro. */}
      <StatusBar style="dark" />
    </>
  );
}
