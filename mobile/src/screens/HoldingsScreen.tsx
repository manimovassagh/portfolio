import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getHoldings } from '../api';
import type { Holding } from '../api';

const BG = '#0f172a';
const CARD = '#1e293b';
const TEAL = '#45b9a8';
const GREEN = '#10b981';
const RED = '#ef4444';
const TEXT = '#f8fafc';
const MUTED = '#64748b';
const SUB = '#94a3b8';
const BORDER = '#334155';

const CLASS_COLORS: Record<string, string> = {
  STOCK: '#3b82f6',
  ETF: '#8b5cf6',
  FUND: '#8b5cf6',
  CRYPTO: '#f59e0b',
  BOND: '#06b6d4',
};

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pnlColor(n: number | null | undefined) {
  if (n == null) return TEXT;
  return n >= 0 ? GREEN : RED;
}

type HoldingCardProps = { item: Holding };
function HoldingCard({ item: h }: HoldingCardProps) {
  const classColor = CLASS_COLORS[h.asset_class?.toUpperCase()] ?? TEAL;
  const initial = h.name?.[0]?.toUpperCase() ?? '?';
  const pct = h.unrealized_pct;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: classColor + '22', borderColor: classColor + '55' }]}>
          <Text style={[styles.avatarText, { color: classColor }]}>{initial}</Text>
        </View>
        <View style={styles.cardMid}>
          <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: classColor + '22' }]}>
              <Text style={[styles.tagText, { color: classColor }]}>{h.asset_class}</Text>
            </View>
            <Text style={styles.isin}>{h.isin}</Text>
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.pnl, { color: pnlColor(h.unrealized_pnl) }]}>
            {h.unrealized_pnl != null ? `${h.unrealized_pnl >= 0 ? '+' : '-'}€${fmt(Math.abs(h.unrealized_pnl))}` : '—'}
          </Text>
          <Text style={[styles.pct, { color: pnlColor(pct) }]}>
            {pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.cardBottom}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Shares</Text>
          <Text style={styles.statValue}>{h.shares.toFixed(4)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Avg cost</Text>
          <Text style={styles.statValue}>€{fmt(h.avg_cost)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Market value</Text>
          <Text style={styles.statValue}>€{fmt(h.market_value)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Weight</Text>
          <Text style={styles.statValue}>{(h.weight * 100).toFixed(1)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function HoldingsScreen() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      const data = await getHoldings();
      setHoldings(data.holdings);
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

  return (
    <FlatList
      style={styles.list}
      data={holdings}
      keyExtractor={(h) => h.isin}
      renderItem={({ item }) => <HoldingCard item={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
      ListHeaderComponent={
        holdings.length > 0 ? (
          <Text style={styles.count}>{holdings.length} positions</Text>
        ) : null
      }
      ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>No holdings found</Text></View>}
      contentContainerStyle={holdings.length === 0 ? { flex: 1 } : { padding: 12, paddingBottom: 32 }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  error: { color: RED, fontSize: 14, fontWeight: '600' },
  empty: { color: MUTED, fontSize: 14, fontWeight: '600' },
  count: { fontSize: 11, color: MUTED, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '900' },
  cardMid: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: TEXT, marginBottom: 4 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  isin: { fontSize: 10, color: SUB, fontWeight: '500' },
  cardRight: { alignItems: 'flex-end' },
  pnl: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  pct: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 14 },
  cardBottom: { flexDirection: 'row', padding: 12, paddingTop: 10, gap: 4 },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 9, color: MUTED, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  statValue: { fontSize: 12, color: SUB, fontWeight: '700' },
});
