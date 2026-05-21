import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getMarketQuote, searchMarket } from '../api';
import type { MarketQuote, MarketSearchResult } from '../api';

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function QuoteCard({ quote }: { quote: MarketQuote }) {
  const up = quote.change_pct >= 0;
  const color = up ? '#10b981' : '#ef4444';
  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteRow}>
        <Text style={styles.quoteTicker}>{quote.ticker}</Text>
        <Text style={[styles.quotePrice, { color }]}>{quote.currency} {fmt(quote.price)}</Text>
      </View>
      <View style={styles.quoteRow}>
        <Text style={styles.quoteSub}>Prev close: {fmt(quote.prev_close)}</Text>
        <Text style={[styles.quoteChange, { color }]}>
          {up ? '+' : ''}{fmt(quote.change)} ({up ? '+' : ''}{fmt(quote.change_pct)}%)
        </Text>
      </View>
      {quote.market_cap != null && (
        <Text style={styles.quoteSub}>Market cap: {fmt(quote.market_cap / 1e9, 1)}B</Text>
      )}
    </View>
  );
}

type ResultRowProps = { item: MarketSearchResult; onSelect: (symbol: string) => void };
function ResultRow({ item, onSelect }: ResultRowProps) {
  return (
    <TouchableOpacity style={styles.resultRow} onPress={() => onSelect(item.ticker)}>
      <View style={styles.resultLeft}>
        <Text style={styles.resultSymbol}>{item.ticker}</Text>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
      </View>
      <Text style={styles.resultMeta}>{item.exchange}</Text>
    </TouchableOpacity>
  );
}

export function MarketsScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketSearchResult[]>([]);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [searching, setSearching] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (text: string) => {
    setQuery(text);
    setQuote(null);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const data = await searchMarket(text.trim());
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (symbol: string) => {
    setResults([]);
    setQuery(symbol);
    setQuoting(true);
    try {
      const data = await getMarketQuote(symbol);
      setQuote(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote');
    } finally {
      setQuoting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search ticker or name…"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching && <ActivityIndicator style={styles.spinner} color="#45b9a8" />}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {results.length > 0 && (
        <FlatList
          style={styles.results}
          data={results}
          keyExtractor={(i) => i.ticker}
          renderItem={({ item }) => <ResultRow item={item} onSelect={handleSelect} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {quoting && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#45b9a8" />
        </View>
      )}

      {quote && !quoting && <QuoteCard quote={quote} />}

      {!quote && !quoting && results.length === 0 && !searching && (
        <View style={styles.center}>
          <Text style={styles.hint}>Search for a stock, ETF, or crypto</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  input: { flex: 1, height: 44, fontSize: 15, color: '#0f172a', fontWeight: '600' },
  spinner: { marginLeft: 8 },
  error: { color: '#ef4444', fontSize: 13, fontWeight: '600', marginHorizontal: 16, marginBottom: 8 },
  results: { backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 10, maxHeight: 280, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  resultLeft: { flex: 1, marginRight: 8 },
  resultSymbol: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  resultName: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 1 },
  resultMeta: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  quoteCard: { backgroundColor: '#fff', margin: 12, borderRadius: 14, padding: 18, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  quoteTicker: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  quotePrice: { fontSize: 22, fontWeight: '900' },
  quoteSub: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  quoteChange: { fontSize: 14, fontWeight: '700' },
});
