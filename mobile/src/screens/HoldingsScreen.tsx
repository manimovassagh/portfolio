import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getHoldings } from '../api';
import type { Holding } from '../api';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signed(n: number | null | undefined): string {
  if (n == null) return '—';
  const s = fmt(n);
  return n >= 0 ? `+€${s}` : `-€${fmt(Math.abs(n))}`;
}

function pctColor(n: number | null | undefined) {
  if (n == null) return '#0f172a';
  return n >= 0 ? '#10b981' : '#ef4444';
}

type HoldingCardProps = { item: Holding; onPress: (h: Holding) => void };
function HoldingCard({ item: h, onPress }: HoldingCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(h)}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
          <Text style={styles.isin}>{h.isin}</Text>
        </View>
        <Text style={[styles.pnl, { color: pctColor(h.unrealized_pnl) }]}>
          {signed(h.unrealized_pnl)}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.meta}>Shares: {h.shares.toFixed(4)}</Text>
        <Text style={styles.meta}>MV: €{fmt(h.market_value)}</Text>
        <Text style={[styles.meta, { color: pctColor(h.unrealized_pct) }]}>
          {h.unrealized_pct != null ? `${h.unrealized_pct >= 0 ? '+' : ''}${h.unrealized_pct.toFixed(2)}%` : '—'}
        </Text>
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#45b9a8" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  return (
    <FlatList
      style={styles.list}
      data={holdings}
      keyExtractor={(h) => h.isin}
      renderItem={({ item }) => <HoldingCard item={item} onPress={() => {}} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#45b9a8" />}
      ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>No holdings found</Text></View>}
      contentContainerStyle={holdings.length === 0 ? { flex: 1 } : { padding: 8, paddingBottom: 24 }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  empty: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 8, marginVertical: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  isin: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginTop: 1 },
  pnl: { fontSize: 14, fontWeight: '800' },
  cardMeta: { flexDirection: 'row', marginTop: 8, gap: 12 },
  meta: { fontSize: 12, color: '#64748b', fontWeight: '600' },
});
