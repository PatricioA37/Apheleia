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
        <Stack.Screen name="seguimiento" options={{ title: 'Seguimiento' }} />
        <Stack.Screen name="indicaciones" options={{ title: 'Indicaciones' }} />
        <Stack.Screen name="calendario" options={{ title: 'Calendario clínico' }} />
        <Stack.Screen name="plan" options={{ title: 'Plan de Salud Integral' }} />
        <Stack.Screen name="alertas" options={{ title: 'Alertas' }} />
        <Stack.Screen name="chat" options={{ title: 'Conversar' }} />
        <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
      </Stack>
      {/* Paleta clara fija: la barra de estado va siempre en oscuro. */}
      <StatusBar style="dark" />
    </>
  );
}
