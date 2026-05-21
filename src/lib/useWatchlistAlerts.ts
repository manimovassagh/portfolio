import { useEffect, useRef } from 'react';
import type { WatchlistItem } from '../types';

const STORAGE_KEY = 'watchlist_alerted';

type AlertedMap = Record<string, number>; // isin → price when alert fired

function loadAlerted(): AlertedMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AlertedMap;
  } catch {
    return {};
  }
}

function saveAlerted(map: AlertedMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export type PriceAlert = {
  isin: string;
  name: string;
  current_price: number;
  target_price: number;
};

// Fires browser notifications and returns new alerts when a watchlist item
// crosses its target price. Remembers alerted ISINs in localStorage so alerts
// don't re-fire until the price retreats above target and crosses again.
export function useWatchlistAlerts(
  items: WatchlistItem[],
  onAlert: (alerts: PriceAlert[]) => void,
): void {
  // Stable ref so the effect never needs to re-register on onAlert change.
  const onAlertRef = useRef(onAlert);
  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);

  useEffect(() => {
    if (!items.length) return;

    const alerted = loadAlerted();
    const newAlerts: PriceAlert[] = [];
    let changed = false;

    for (const item of items) {
      if (item.current_price === null || item.target_price === null) continue;

      const atTarget = item.current_price <= item.target_price;

      if (atTarget && !(item.isin in alerted)) {
        // Price just crossed target — fire alert.
        alerted[item.isin] = item.current_price;
        newAlerts.push({
          isin: item.isin,
          name: item.name,
          current_price: item.current_price,
          target_price: item.target_price,
        });
        changed = true;
      } else if (!atTarget && item.isin in alerted) {
        // Price retreated above target — clear memory so next crossing fires.
        delete alerted[item.isin];
        changed = true;
      }
    }

    if (changed) saveAlerted(alerted);
    if (newAlerts.length) onAlertRef.current(newAlerts);
  }, [items]);
}
