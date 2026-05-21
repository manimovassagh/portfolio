import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getWatchlist, removeFromWatchlist } from '../api';
import type { WatchlistItem } from '../api';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dist(item: WatchlistItem): string {
  if (item.current_price == null || item.target_price == null || item.target_price === 0) return '';
  const pct = ((item.current_price - item.target_price) / item.target_price) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% from target`;
}

type ItemProps = { item: WatchlistItem; onRemove: (isin: string) => void };
function WatchlistCard({ item, onRemove }: ItemProps) {
  const handleRemove = () => {
    Alert.alert('Remove', `Remove ${item.name || item.isin} from watchlist?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(item.isin) },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.name} numberOfLines={1}>{item.name || item.isin}</Text>
          <Text style={styles.ticker}>{item.ticker || item.isin}</Text>
        </View>
        <TouchableOpacity onPress={handleRemove} style={styles.removeBtn}>
          <Text style={styles.removeTxt}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.prices}>
        <View>
          <Text style={styles.priceLabel}>Current</Text>
          <Text style={styles.priceValue}>€{fmt(item.current_price)}</Text>
        </View>
        {item.target_price != null && (
          <View>
            <Text style={styles.priceLabel}>Target</Text>
            <Text style={styles.priceValue}>€{fmt(item.target_price)}</Text>
          </View>
        )}
        {dist(item) ? <Text style={styles.dist}>{dist(item)}</Text> : null}
      </View>
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#45b9a8" /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(i) => i.isin}
      renderItem={({ item }) => <WatchlistCard item={item} onRemove={handleRemove} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#45b9a8" />}
      ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>Watchlist is empty</Text></View>}
      contentContainerStyle={items.length === 0 ? { flex: 1 } : { padding: 8, paddingBottom: 24 }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  empty: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 8, marginVertical: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  ticker: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginTop: 1 },
  removeBtn: { padding: 4 },
  removeTxt: { fontSize: 14, color: '#94a3b8', fontWeight: '700' },
  prices: { flexDirection: 'row', gap: 16, marginTop: 10, alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  priceValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  dist: { fontSize: 12, color: '#64748b', fontWeight: '600' },
});
