import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getAuthSession } from './src/api';
import type { AuthSession } from './src/api';
import { LoginScreen } from './src/screens/LoginScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { HoldingsScreen } from './src/screens/HoldingsScreen';
import { WatchlistScreen } from './src/screens/WatchlistScreen';
import { MarketsScreen } from './src/screens/MarketsScreen';

const Tab = createBottomTabNavigator();

const TEAL = '#45b9a8';

type TabIconProps = { focused: boolean; label: string };
function TabIcon({ focused, label }: TabIconProps) {
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{label}</Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '800', color: '#0f172a' },
        tabBarActiveTintColor: TEAL,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { borderTopColor: '#e2e8f0' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ tabBarIcon: (p) => <TabIcon {...p} label="◎" /> }}
      />
      <Tab.Screen
        name="Holdings"
        component={HoldingsScreen}
        options={{ tabBarIcon: (p) => <TabIcon {...p} label="▤" /> }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{ tabBarIcon: (p) => <TabIcon {...p} label="★" /> }}
      />
      <Tab.Screen
        name="Markets"
        component={MarketsScreen}
        options={{ tabBarIcon: (p) => <TabIcon {...p} label="↗" /> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuthSession()
      .then((s) => {
        // If auth is not required or already authenticated, go straight to main tabs.
        // If auth IS required and not authenticated, show login.
        if (!s.required || s.authenticated) setSession(s);
      })
      .catch(() => {
        // Network error or CORS — treat as no-auth-required so app is still usable.
        setSession({ authenticated: false, required: false, user: null });
      })
      .finally(() => setLoading(false));
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
      <StatusBar style="dark" />
      <NavigationContainer>
        {session ? (
          <MainTabs />
        ) : (
          <LoginScreen onLogin={setSession} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
});
