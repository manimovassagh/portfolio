import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { devLogin } from '../api';
import type { AuthSession } from '../api';

type Props = { onLogin: (session: AuthSession) => void };

export function LoginScreen({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const session = await devLogin();
      onLogin(session);
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>K</Text>
        </View>
        <Text style={styles.title}>Kapital</Text>
        <Text style={styles.subtitle}>Your portfolio, on the go</Text>

        <TouchableOpacity style={styles.button} onPress={handleDevLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue in dev mode</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Passkey / Google / Apple sign-in available when{'\n'}running with AUTH_REQUIRED=true
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#45b9a8', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 32, fontWeight: '600' },
  button: { width: '100%', backgroundColor: '#45b9a8', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18, fontWeight: '500' },
});
