import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getWatchlist, removeFromWatchlist } from '../api';
import type { WatchlistItem } from '../api';

const BG = '#0f172a';
const CARD = '#1e293b';
const TEAL = '#45b9a8';
const GREEN = '#10b981';
const RED = '#ef4444';
const TEXT = '#f8fafc';
const MUTED = '#64748b';
const SUB = '#94a3b8';
const BORDER = '#334155';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function distPct(item: WatchlistItem): number | null {
  if (item.current_price == null || item.target_price == null || item.target_price === 0) return null;
  return ((item.current_price - item.target_price) / item.target_price) * 100;
}

type ItemProps = { item: WatchlistItem; onRemove: (isin: string) => void };
function WatchlistCard({ item, onRemove }: ItemProps) {
  const pct = distPct(item);
  const hasTarget = item.target_price != null;
  const aboveTarget = pct != null && pct >= 0;

  const handleRemove = () => {
    Alert.alert('Remove from watchlist', `Remove ${item.name || item.isin}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(item.isin) },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <Text style={styles.name} numberOfLines={1}>{item.name || item.isin}</Text>
          <Text style={styles.ticker}>{item.ticker || item.isin}</Text>
        </View>
        <TouchableOpacity onPress={handleRemove} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.removeTxt}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Current</Text>
          <Text style={styles.priceValue}>€{fmt(item.current_price)}</Text>
        </View>
        {hasTarget && (
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>Target</Text>
            <Text style={styles.priceValue}>€{fmt(item.target_price)}</Text>
          </View>
        )}
        {pct != null && (
          <View style={[styles.distBadge, { backgroundColor: aboveTarget ? GREEN + '22' : RED + '22' }]}>
            <Text style={[styles.distText, { color: aboveTarget ? GREEN : RED }]}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% from target
            </Text>
          </View>
        )}
      </View>

      {item.notes ? <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text> : null}
    </View>
  );
}

export function WatchlistScreen() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      const data = await getWatchlist();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemove = async (isin: string) => {
    try {
      await removeFromWatchlist(isin);
      setItems((prev) => prev.filter((i) => i.isin !== isin));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(i) => i.isin}
      renderItem={({ item }) => <WatchlistCard item={item} onRemove={handleRemove} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>★</Text>
          <Text style={styles.emptyTitle}>Watchlist is empty</Text>
          <Text style={styles.emptySub}>Add positions from the web app to track them here</Text>
        </View>
      }
      contentContainerStyle={items.length === 0 ? { flex: 1 } : { padding: 12, paddingBottom: 32 }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, paddingHorizontal: 32 },
  error: { color: RED, fontSize: 14, fontWeight: '600' },
  emptyIcon: { fontSize: 36, color: MUTED, marginBottom: 12 },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySub: { color: MUTED, fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardLeft: { flex: 1, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 3 },
  ticker: { fontSize: 12, color: TEAL, fontWeight: '700', letterSpacing: 0.5 },
  removeBtn: { padding: 2 },
  removeTxt: { fontSize: 14, color: MUTED, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  priceBlock: {},
  priceLabel: { fontSize: 10, color: MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  priceValue: { fontSize: 16, fontWeight: '800', color: TEXT },
  distBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 'auto' as unknown as number },
  distText: { fontSize: 12, fontWeight: '700' },
  notes: { marginTop: 10, fontSize: 12, color: SUB, lineHeight: 18 },
});
