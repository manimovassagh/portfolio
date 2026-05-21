import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSummary } from '../api';
import type { Summary } from '../api';

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function signed(n: number | null | undefined): string {
  if (n == null) return '—';
  const s = fmt(n);
  return n >= 0 ? `+${s}` : s;
}

function pctColor(n: number | null | undefined) {
  if (n == null) return styles.neutral;
  return n >= 0 ? styles.green : styles.red;
}

type MetricProps = { label: string; value: string; sub?: string; color?: object };
function Metric({ label, value, sub, color }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

export function OverviewScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      const data = await getSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#45b9a8" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  const s = summary!;
  return (
    <ScrollView
      style={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#45b9a8" />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Portfolio value</Text>
        <Text style={styles.heroValue}>€ {fmt(s.portfolio_value)}</Text>
        <Text style={[styles.heroPnl, pctColor(s.unrealized_pct)]}>
          {signed(s.unrealized_pnl)} ({signed(s.unrealized_pct)}%)
        </Text>
      </View>

      <View style={styles.grid}>
        <Metric label="Market value" value={`€ ${fmt(s.market_value)}`} />
        <Metric label="Cash" value={`€ ${fmt(s.cash_balance)}`} />
        <Metric label="Cost basis" value={`€ ${fmt(s.cost_basis)}`} />
        <Metric label="Realized P&L" value={`€ ${signed(s.realized_pnl)}`} color={pctColor(s.realized_pnl)} />
        <Metric label="Total return" value={`${signed(s.total_return ? s.total_return * 100 : null)}%`} color={pctColor(s.total_return)} />
        <Metric label="Dividends" value={`€ ${fmt(s.dividends)}`} />
        <Metric label="Holdings" value={String(s.n_holdings)} />
        <Metric label="XIRR" value={s.xirr != null ? `${fmt(s.xirr * 100)}%` : '—'} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  hero: { backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  heroLabel: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  heroValue: { fontSize: 36, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  heroPnl: { fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 24 },
  metric: { width: '50%', padding: 8 },
  metricLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  metricValue: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  metricSub: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginTop: 1 },
  green: { color: '#10b981' },
  red: { color: '#ef4444' },
  neutral: { color: '#0f172a' },
});
