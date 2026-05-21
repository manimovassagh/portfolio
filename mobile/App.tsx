import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getAuthSession, devLogin } from './src/api';
import type { AuthSession } from './src/api';
import { LoginScreen } from './src/screens/LoginScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { HoldingsScreen } from './src/screens/HoldingsScreen';
import { WatchlistScreen } from './src/screens/WatchlistScreen';
import { MarketsScreen } from './src/screens/MarketsScreen';

const Tab = createBottomTabNavigator();

const TEAL = '#45b9a8';
const BG = '#0f172a';
const SURFACE = '#1e293b';
const BORDER = '#1e293b';

const NavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: BG, card: SURFACE, border: BORDER },
};

type TabIconProps = { focused: boolean; label: string; color: string };
function TabIcon({ focused, label, color }: TabIconProps) {
  return <Text style={{ fontSize: 20, color, opacity: focused ? 1 : 0.5 }}>{label}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: SURFACE },
        headerTitleStyle: { fontWeight: '800', color: '#f8fafc', fontSize: 17 },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: SURFACE, borderTopColor: '#334155', borderTopWidth: 1, height: 58, paddingBottom: 8 },
        tabBarActiveTintColor: TEAL,
        tabBarInactiveTintColor: '#475569',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
      }}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} label="◎" /> }}
      />
      <Tab.Screen
        name="Holdings"
        component={HoldingsScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} label="▤" /> }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} label="★" /> }}
      />
      <Tab.Screen
        name="Markets"
        component={MarketsScreen}
        options={{ tabBarIcon: ({ focused, color }) => <TabIcon focused={focused} color={color} label="↗" /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getAuthSession();
        if (!s.required) {
          // Dev mode: establish a real session so auth-gated endpoints work.
          try { await devLogin(); } catch {}
          setSession(s);
        } else if (s.authenticated) {
          setSession(s);
        }
        // else: required + not authenticated → stay on login screen
      } catch {
        // Network/cert error — try dev login anyway so endpoints work.
        try { await devLogin(); } catch {}
        setSession({ authenticated: false, required: false, user: null });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={NavTheme}>
        {session ? <MainTabs /> : <LoginScreen onLogin={setSession} />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
});
