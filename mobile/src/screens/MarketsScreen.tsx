import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getMarketQuote, searchMarket } from '../api';
import type { MarketQuote, MarketSearchResult } from '../api';

const BG = '#0f172a';
const CARD = '#1e293b';
const INPUT_BG = '#162032';
const TEAL = '#45b9a8';
const GREEN = '#10b981';
const RED = '#ef4444';
const TEXT = '#f8fafc';
const MUTED = '#64748b';
const SUB = '#94a3b8';
const BORDER = '#334155';

const SUGGESTIONS: { ticker: string; label: string; category: string }[] = [
  { ticker: 'IWDA.L',  label: 'MSCI World',    category: 'ETF' },
  { ticker: 'CSPX.L',  label: 'S&P 500',        category: 'ETF' },
  { ticker: 'EQQQ.L',  label: 'Nasdaq 100',      category: 'ETF' },
  { ticker: 'AAPL',    label: 'Apple',           category: 'STOCK' },
  { ticker: 'MSFT',    label: 'Microsoft',       category: 'STOCK' },
  { ticker: 'NVDA',    label: 'Nvidia',          category: 'STOCK' },
  { ticker: 'TSLA',    label: 'Tesla',           category: 'STOCK' },
  { ticker: 'BTC-USD', label: 'Bitcoin',         category: 'CRYPTO' },
  { ticker: 'ETH-USD', label: 'Ethereum',        category: 'CRYPTO' },
];

const CAT_COLORS: Record<string, string> = {
  ETF: '#8b5cf6',
  STOCK: '#3b82f6',
  CRYPTO: '#f59e0b',
};

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function QuoteCard({ quote }: { quote: MarketQuote }) {
  const up = quote.change_pct >= 0;
  const color = up ? GREEN : RED;
  return (
    <View style={styles.quoteCard}>
      <View style={styles.quoteTop}>
        <View>
          <Text style={styles.quoteTicker}>{quote.ticker}</Text>
          <Text style={styles.quoteCurrency}>{quote.currency}</Text>
        </View>
        <View style={styles.quoteRight}>
          <Text style={[styles.quotePrice, { color }]}>{fmt(quote.price)}</Text>
          <View style={[styles.changeBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.changeText, { color }]}>
              {up ? '+' : ''}{fmt(quote.change)} ({up ? '+' : ''}{fmt(quote.change_pct)}%)
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.quoteDivider} />
      <View style={styles.quoteStats}>
        <View style={styles.quoteStat}>
          <Text style={styles.quoteStatLabel}>Prev close</Text>
          <Text style={styles.quoteStatValue}>{fmt(quote.prev_close)}</Text>
        </View>
        {quote.market_cap != null && (
          <View style={styles.quoteStat}>
            <Text style={styles.quoteStatLabel}>Market cap</Text>
            <Text style={styles.quoteStatValue}>{fmt(quote.market_cap / 1e9, 1)}B</Text>
          </View>
        )}
      </View>
    </View>
  );
}

type ResultRowProps = { item: MarketSearchResult; onSelect: (ticker: string) => void };
function ResultRow({ item, onSelect }: ResultRowProps) {
  return (
    <TouchableOpacity style={styles.resultRow} onPress={() => onSelect(item.ticker)} activeOpacity={0.7}>
      <View style={styles.resultLeft}>
        <Text style={styles.resultTicker}>{item.ticker}</Text>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
      </View>
      <View style={styles.exchangeBadge}>
        <Text style={styles.exchangeText}>{item.exchange}</Text>
      </View>
    </TouchableOpacity>
  );
}

type SuggestionChipProps = { ticker: string; label: string; category: string; onPress: (ticker: string) => void };
function SuggestionChip({ ticker, label, category, onPress }: SuggestionChipProps) {
  const color = CAT_COLORS[category] ?? TEAL;
  return (
    <TouchableOpacity style={[styles.chip, { borderColor: color + '44' }]} onPress={() => onPress(ticker)} activeOpacity={0.7}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.chipTicker}>{ticker}</Text>
        <Text style={styles.chipLabel}>{label}</Text>
      </View>
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

  const handleSelect = async (ticker: string) => {
    setResults([]);
    setQuery(ticker);
    setQuoting(true);
    try {
      const data = await getMarketQuote(ticker);
      setQuote(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quote');
    } finally {
      setQuoting(false);
    }
  };

  const showSuggestions = query.length === 0 && !quote;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.input}
            placeholder="Search ticker or company…"
            placeholderTextColor={MUTED}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && <ActivityIndicator style={{ marginLeft: 8 }} color={TEAL} size="small" />}
          {query.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setQuote(null); }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Search results dropdown */}
      {results.length > 0 && (
        <View style={styles.results}>
          <FlatList
            data={results}
            keyExtractor={(i) => i.ticker}
            renderItem={({ item }) => <ResultRow item={item} onSelect={handleSelect} />}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
          />
        </View>
      )}

      {/* Quote card */}
      {quoting && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      )}
      {quote && !quoting && <QuoteCard quote={quote} />}

      {/* Pre-suggestions when nothing searched */}
      {showSuggestions && !searching && (
        <ScrollView style={styles.suggestionsScroll} contentContainerStyle={styles.suggestionsContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.suggestionsTitle}>Popular</Text>
          <View style={styles.chipsGrid}>
            {SUGGESTIONS.map((s) => (
              <SuggestionChip key={s.ticker} {...s} onPress={handleSelect} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  searchWrap: { padding: 12, paddingBottom: 0 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { fontSize: 20, color: MUTED, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: TEXT, fontWeight: '600' },
  clearBtn: { fontSize: 14, color: MUTED, fontWeight: '700', padding: 4 },

  error: { color: RED, fontSize: 13, fontWeight: '600', margin: 12, marginTop: 8 },

  results: {
    backgroundColor: CARD,
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  resultLeft: { flex: 1, marginRight: 8 },
  resultTicker: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 2 },
  resultName: { fontSize: 12, color: SUB, fontWeight: '500' },
  exchangeBadge: { backgroundColor: TEAL + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  exchangeText: { fontSize: 10, color: TEAL, fontWeight: '800', letterSpacing: 0.5 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  quoteCard: {
    backgroundColor: CARD,
    margin: 12,
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  quoteTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20 },
  quoteTicker: { fontSize: 24, fontWeight: '900', color: TEXT, marginBottom: 2 },
  quoteCurrency: { fontSize: 12, color: MUTED, fontWeight: '600' },
  quoteRight: { alignItems: 'flex-end' },
  quotePrice: { fontSize: 28, fontWeight: '900', marginBottom: 6 },
  changeBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  changeText: { fontSize: 13, fontWeight: '700' },
  quoteDivider: { height: 1, backgroundColor: BORDER },
  quoteStats: { flexDirection: 'row', padding: 16, gap: 24 },
  quoteStat: {},
  quoteStatLabel: { fontSize: 10, color: MUTED, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  quoteStatValue: { fontSize: 15, fontWeight: '700', color: SUB },

  suggestionsScroll: { flex: 1 },
  suggestionsContent: { padding: 12, paddingTop: 16 },
  suggestionsTitle: { fontSize: 11, color: MUTED, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: '47%',
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipTicker: { fontSize: 13, fontWeight: '800', color: TEXT, marginBottom: 1 },
  chipLabel: { fontSize: 11, color: SUB, fontWeight: '500' },
});
