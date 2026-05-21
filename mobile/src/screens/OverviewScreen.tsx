import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSummary } from '../api';
import type { Summary } from '../api';

const BG = '#0f172a';
const CARD = '#1e293b';
const HERO = '#162032';
const TEAL = '#45b9a8';
const GREEN = '#10b981';
const RED = '#ef4444';
const TEXT = '#f8fafc';
const MUTED = '#64748b';
const SUB = '#94a3b8';

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function signed(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${fmt(n)}`;
}

function pnlColor(n: number | null | undefined) {
  if (n == null) return TEXT;
  return n >= 0 ? GREEN : RED;
}

type MetricProps = { label: string; value: string; valueColor?: string };
function Metric({ label, value, valueColor }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  const s = summary!;
  const pct = s.unrealized_pct;
  const pnl = s.unrealized_pnl;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Portfolio value</Text>
        <Text style={styles.heroValue}>€ {fmt(s.portfolio_value)}</Text>
        <View style={styles.heroBadge}>
          <Text style={[styles.heroPnl, { color: pnlColor(pnl) }]}>
            {signed(pnl)} ({pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'})
          </Text>
        </View>
      </View>

      {/* Metrics grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.grid}>
          <Metric label="Market value" value={`€ ${fmt(s.market_value)}`} />
          <Metric label="Cash" value={`€ ${fmt(s.cash_balance)}`} />
          <Metric label="Cost basis" value={`€ ${fmt(s.cost_basis)}`} />
          <Metric label="Realized P&L" value={`€ ${signed(s.realized_pnl)}`} valueColor={pnlColor(s.realized_pnl)} />
          <Metric label="Total return" value={s.total_return != null ? `${(s.total_return * 100).toFixed(2)}%` : '—'} valueColor={pnlColor(s.total_return)} />
          <Metric label="Dividends" value={`€ ${fmt(s.dividends)}`} />
          <Metric label="Holdings" value={String(s.n_holdings)} />
          <Metric label="XIRR" value={s.xirr != null ? `${(s.xirr * 100).toFixed(2)}%` : '—'} valueColor={pnlColor(s.xirr)} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  error: { color: RED, fontSize: 14, fontWeight: '600' },

  hero: {
    backgroundColor: HERO,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  heroLabel: { fontSize: 12, color: MUTED, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  heroValue: { fontSize: 40, fontWeight: '900', color: TEXT, letterSpacing: -1, marginBottom: 8 },
  heroBadge: { backgroundColor: '#0f2d20', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  heroPnl: { fontSize: 15, fontWeight: '700' },

  section: { marginTop: 24, marginHorizontal: 16 },
  sectionTitle: { fontSize: 11, color: MUTED, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: { fontSize: 11, color: SUB, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  metricValue: { fontSize: 18, fontWeight: '800', color: TEXT },
});
