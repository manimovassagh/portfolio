// Trade Republic Portfolio — Alpine.js dashboard logic
// Charts: ApexCharts. State: single Alpine x-data root.

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function dashboard() {
  return {
    // ── state ─────────────────────────────────────────────────────
    dark: true,
    loading: false,
    mobileOpen: false,
    active: 'overview',
    chartMode: 'Value',
    lastUpdated: '—',

    exports: [],
    export_name: null,
    holderName: null,

    summary: null,
    holdings: [],
    totalMV: 0,
    perf: null,
    cashFlow: null,
    income: [],
    incomeTotals: {},
    realized: [],
    realizedTotal: 0,
    tax: [],
    sparklines: {},

    modal: { open: false, isin: null, name: null, current: null, transactions: [] },
    dragging: false,
    uploadToast: null,
    analytics: null,
    rebalanceMode: false,
    rebalanceTargets: {},
    taxHarvestMode: false,

    sections: [
      { id: 'overview',  label: 'Overview',     icon: 'layout-dashboard' },
      { id: 'analytics', label: 'Analytics',    icon: 'bar-chart-2' },
      { id: 'holdings',  label: 'Holdings',     icon: 'briefcase' },
      { id: 'cash',      label: 'Cash flow',    icon: 'arrow-left-right' },
      { id: 'income',    label: 'Income',       icon: 'wallet' },
      { id: 'realized',  label: 'Realized P&L', icon: 'check-circle' },
      { id: 'tax',       label: 'Tax',          icon: 'receipt' },
    ],

    // ── lifecycle ─────────────────────────────────────────────────
    async init() {
      const stored = localStorage.getItem('theme');
      if (stored === 'light') {
        this.dark = false;
        document.documentElement.classList.remove('dark');
      }
      const savedTab = localStorage.getItem('activeTab');
      if (savedTab && this.sections.find(s => s.id === savedTab)) this.active = savedTab;
      const savedTargets = localStorage.getItem('kapital_targets');
      if (savedTargets) { try { this.rebalanceTargets = JSON.parse(savedTargets); } catch {} }
      window.lucide && lucide.createIcons();

      const { exports } = await (await fetch('/api/exports')).json();
      this.exports = exports;
      this.export_name = exports[0] || null;
      await this.loadAll();
    },

    async uploadCSV(event) {
      const file = event.target.files[0];
      if (!file) return;
      await this._doUpload(file);
      event.target.value = '';
    },

    async dropCSV(event) {
      this.dragging = false;
      const file = event.dataTransfer.files[0];
      if (!file || !file.name.endsWith('.csv')) return;
      await this._doUpload(file);
    },

    async _doUpload(file) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (!res.ok) { const e = await res.json(); alert(e.detail || 'Upload failed'); return; }
        const { filename, exports } = await res.json();
        this.exports = exports;
        this.export_name = filename;
        await this.loadAll();
        this.uploadToast = `Loaded ${filename}`;
        setTimeout(() => { this.uploadToast = null; }, 3000);
      } catch {
        alert('Upload failed — check the server.');
      }
    },

    navigate(id) {
      this.active = id;
      localStorage.setItem('activeTab', id);
      this.$nextTick(() => { lucide.createIcons(); this.renderAllCharts(); });
    },

    toggleTheme() {
      this.dark = !this.dark;
      document.documentElement.classList.toggle('dark', this.dark);
      localStorage.setItem('theme', this.dark ? 'dark' : 'light');
      this.$nextTick(() => { lucide.createIcons(); this.renderAllCharts(); });
    },

    async refresh() {
      this.loading = true;
      try { await this.loadAll(); } finally { this.loading = false; }
    },

    async loadAll() {
      const q = `?export=${encodeURIComponent(this.export_name || '')}`;
      const [summary, holdings, perf, cashFlow, income, realized, tax, sparks, analytics] = await Promise.all([
        fetch('/api/summary'     + q).then(r => r.json()),
        fetch('/api/holdings'    + q).then(r => r.json()),
        fetch('/api/performance' + q).then(r => r.json()),
        fetch('/api/cash_flow'   + q).then(r => r.json()),
        fetch('/api/income'      + q).then(r => r.json()),
        fetch('/api/realized'    + q).then(r => r.json()),
        fetch('/api/tax'         + q).then(r => r.json()),
        fetch('/api/sparklines'  + q).then(r => r.json()),
        fetch('/api/analytics'   + q).then(r => r.json()),
      ]);

      this.summary       = summary;
      if (summary.holder_name) this.holderName = summary.holder_name;
      this.holdings      = holdings.holdings;
      this.totalMV       = holdings.total_market_value;
      this.perf          = perf;
      this.cashFlow      = cashFlow;
      this.income        = income.log;
      this.incomeTotals  = income.totals;
      this.realized      = realized.realized;
      this.realizedTotal = realized.total;
      this.tax           = tax.records;
      this.sparklines    = sparks.sparklines;
      this.analytics     = analytics;
      this.lastUpdated   = new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

      this.$nextTick(() => { lucide.createIcons(); this.renderAllCharts(); });
    },

    // ── formatting helpers ────────────────────────────────────────
    fmtEUR(v) {
      if (v === null || v === undefined || isNaN(v)) return '—';
      const abs = Math.abs(v);
      const opts = abs >= 10000
        ? { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }
        : { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 };
      return new Intl.NumberFormat('en-IE', opts).format(v);
    },

    typeBadge(t) {
      const map = {
        BUY:                 'bg-sky-500/15 text-sky-400',
        SELL:                'bg-amber-500/15 text-amber-400',
        DIVIDEND:            'bg-emerald-500/15 text-emerald-400',
        INTEREST_PAYMENT:    'bg-emerald-500/15 text-emerald-400',
        STOCKPERK:           'bg-violet-500/15 text-violet-400',
        EARNINGS:            'bg-rose-500/15 text-rose-400',
        TRANSFER_INBOUND:    'bg-ink-500/15 text-ink-400',
        TRANSFER_INSTANT_INBOUND: 'bg-ink-500/15 text-ink-400',
        CUSTOMER_INPAYMENT:  'bg-ink-500/15 text-ink-400',
      };
      return map[t] || 'bg-ink-500/15 text-ink-400';
    },

    classColor(c) {
      return {
        STOCK:  'linear-gradient(135deg,#0ea5e9,#0369a1)',
        FUND:   'linear-gradient(135deg,#10b981,#047857)',
        CRYPTO: 'linear-gradient(135deg,#f59e0b,#b45309)',
      }[c] || 'linear-gradient(135deg,#71717a,#3f3f46)';
    },

    currentLabel() {
      return this.sections.find(s => s.id === this.active)?.label || 'Overview';
    },

    incomeTotal() {
      return Object.values(this.incomeTotals || {}).reduce((a, b) => a + b, 0);
    },

    // ── KPI cards ─────────────────────────────────────────────────
    get kpis() {
      const s = this.summary;
      if (!s) return Array.from({ length: 6 }, () => ({
        label: '—', value: '—', delta: '', deltaClass: '', icon: 'loader-2', colorClass: 'text-ink-400'
      }));
      const fmt = (v) => this.fmtEUR(v);
      const pct = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';

      return [
        {
          label: 'Portfolio value',
          value: fmt(s.portfolio_value),
          delta: s.net_deposits ? `${s.portfolio_value >= s.net_deposits ? '+' : ''}${fmt(s.portfolio_value - s.net_deposits)} vs deposits` : '',
          deltaClass: s.portfolio_value >= s.net_deposits ? 'text-emerald-500' : 'text-rose-500',
          deltaIcon: s.portfolio_value >= s.net_deposits ? 'trending-up' : 'trending-down',
          icon: 'wallet', colorClass: '',
          accentClass: s.portfolio_value >= s.net_deposits ? 'card-gain' : 'card-loss',
        },
        {
          label: 'Unrealized P&L',
          value: (s.unrealized_pnl >= 0 ? '+' : '') + fmt(s.unrealized_pnl),
          delta: (s.unrealized_pct >= 0 ? '+' : '') + s.unrealized_pct.toFixed(2) + '%',
          deltaClass: s.unrealized_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500',
          deltaIcon: s.unrealized_pnl >= 0 ? 'arrow-up-right' : 'arrow-down-right',
          icon: 'trending-up',
          colorClass: s.unrealized_pnl >= 0 ? 'text-emerald-500 glow-green' : 'text-rose-500 glow-rose',
          accentClass: s.unrealized_pnl >= 0 ? 'card-gain' : 'card-loss',
        },
        {
          label: 'Realized P&L',
          value: (s.realized_pnl >= 0 ? '+' : '') + fmt(s.realized_pnl),
          delta: s.n_realized + ' closed trade' + (s.n_realized === 1 ? '' : 's'),
          deltaClass: 'text-ink-500', deltaIcon: 'check', icon: 'check-circle-2',
          colorClass: s.realized_pnl >= 0 ? 'text-emerald-500 glow-green' : 'text-rose-500 glow-rose',
          accentClass: s.realized_pnl >= 0 ? 'card-gain' : 'card-neutral',
        },
        {
          label: 'XIRR (annualized)',
          value: s.xirr !== null && s.xirr !== undefined ? pct(s.xirr) : '—',
          delta: 'money-weighted return', deltaClass: 'text-ink-500', deltaIcon: 'percent', icon: 'activity',
          colorClass: (s.xirr ?? 0) >= 0 ? 'text-emerald-500 glow-green' : 'text-rose-500 glow-rose',
          accentClass: 'card-perf',
        },
        {
          label: 'Net deposits',
          value: fmt(s.net_deposits),
          delta: `${s.n_holdings} open position${s.n_holdings === 1 ? '' : 's'}`,
          deltaClass: 'text-ink-500', deltaIcon: 'arrow-down-to-line', icon: 'piggy-bank',
          colorClass: '', accentClass: 'card-neutral',
        },
        {
          label: 'Cash balance',
          value: fmt(s.cash_balance),
          delta: 'uninvested', deltaClass: 'text-ink-500', deltaIcon: 'banknote', icon: 'coins',
          colorClass: '', accentClass: s.cash_balance > 50 ? 'card-warn' : 'card-neutral',
        },
      ];
    },

    get movers() {
      return [...this.holdings]
        .filter(h => h.unrealized_pnl !== null)
        .sort((a, b) => Math.abs(b.unrealized_pnl) - Math.abs(a.unrealized_pnl))
        .slice(0, 6)
        .map(h => ({ isin: h.isin, name: h.name, pnl: h.unrealized_pnl, pct: h.unrealized_pct || 0 }));
    },

    get rollingReturns() {
      const placeholder = ['1M','3M','6M','12M','YTD'].map(label => ({ label, pct: null }));
      if (!this.perf?.twr?.length) return placeholder;
      const twr = this.perf.twr;
      const last = twr[twr.length - 1];
      const currentMult = 1 + last.twr / 100;
      const lastDate = new Date(last.date);
      const periods = [
        { label: '1M',  target: new Date(lastDate.getFullYear(), lastDate.getMonth() - 1, lastDate.getDate()) },
        { label: '3M',  target: new Date(lastDate.getFullYear(), lastDate.getMonth() - 3, lastDate.getDate()) },
        { label: '6M',  target: new Date(lastDate.getFullYear(), lastDate.getMonth() - 6, lastDate.getDate()) },
        { label: '12M', target: new Date(lastDate.getFullYear() - 1, lastDate.getMonth(), lastDate.getDate()) },
        { label: 'YTD', target: new Date(lastDate.getFullYear(), 0, 1) },
      ];
      return periods.map(({ label, target }) => {
        const past = [...twr].reverse().find(p => new Date(p.date) <= target);
        if (!past) return { label, pct: null };
        const pastMult = 1 + past.twr / 100;
        return { label, pct: (currentMult / pastMult - 1) * 100 };
      });
    },

    // ── modal ─────────────────────────────────────────────────────
    async openAsset(isin) {
      const q = `?export=${encodeURIComponent(this.export_name || '')}`;
      const data = await fetch(`/api/asset/${encodeURIComponent(isin)}${q}`).then(r => r.json());
      this.modal = { open: true, ...data };
      this.$nextTick(() => lucide.createIcons());
    },

    // ── charts ────────────────────────────────────────────────────
    chartRefs: {},

    apexTheme() {
      const dark = this.dark;
      return {
        chart: { foreColor: dark ? '#52525b' : '#52525b', background: 'transparent', toolbar: { show: false }, animations: { speed: 400, easing: 'easeinout' } },
        tooltip: { theme: dark ? 'dark' : 'light' },
        grid: { borderColor: dark ? '#16161f' : '#e4e4e7', strokeDashArray: 4, padding: { left: 8, right: 8 } },
        xaxis: { axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { fontSize: '10px', fontFamily: 'JetBrains Mono' } } },
        yaxis: { labels: { style: { fontSize: '10px', fontFamily: 'JetBrains Mono' } } },
      };
    },

    renderAllCharts() {
      this.renderHeroChart();
      this.renderTreemap();
      this.renderCashChart();
      this.renderBucketChart();
      this.renderAllSparklines();
      this.renderHeatmap();
      this.renderAnnualChart();
      this.renderSectorDonut();
      this.renderPnlChart();
    },

    destroyChart(key) {
      if (this.chartRefs[key]) {
        try { this.chartRefs[key].destroy(); } catch (e) { /* noop */ }
        delete this.chartRefs[key];
      }
    },

    renderHeroChart() {
      this.destroyChart('hero');
      const el = document.getElementById('hero-chart');
      if (!el || !this.perf) return;
      const t = this.apexTheme();

      let series, yFormatter, widths;
      if (this.chartMode === 'Value') {
        const port = this.perf.series.map(p => ({ x: p.date, y: p.portfolio_value }));
        const dep  = this.perf.series.map(p => ({ x: p.date, y: p.contributions }));
        series = [
          { name: 'Portfolio', data: port },
          { name: 'Deposits',  data: dep },
        ];
        if (this.perf.benchmark) {
          series.push({
            name: this.perf.benchmark.name,
            data: this.perf.benchmark.series.map(p => ({ x: p.date, y: p.value })),
          });
        }
        widths = [3, 2, 2];
        yFormatter = (v) => (v === null || v === undefined) ? '' : this.fmtEUR(v);
      } else if (this.chartMode === 'TWR') {
        series = [{ name: 'TWR %', data: this.perf.twr.map(p => ({ x: p.date, y: p.twr })) }];
        widths = [2.5];
        yFormatter = (v) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
      } else {
        series = [{ name: 'Drawdown %', data: this.perf.drawdown.map(p => ({ x: p.date, y: p.drawdown })) }];
        widths = [2.5];
        yFormatter = (v) => v.toFixed(2) + '%';
      }

      const opts = {
        chart: { ...t.chart, type: 'area', height: 360 },
        series,
        colors: ['#10b981', '#6366f1', '#f59e0b'],
        stroke: { curve: 'smooth', width: widths },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: this.chartMode === 'Drawdown' ? 0.35 : 0.25,
            opacityTo: 0,
            stops: [0, 100],
          },
        },
        xaxis: { ...t.xaxis, type: 'datetime' },
        yaxis: { ...t.yaxis, labels: { ...t.yaxis.labels, formatter: yFormatter } },
        tooltip: { ...t.tooltip, x: { format: 'dd MMM yyyy' }, y: { formatter: yFormatter } },
        grid: t.grid,
        legend: {
          position: 'top',
          horizontalAlign: 'right',
          fontSize: '12px',
          markers: { width: 8, height: 8, radius: 4 },
          labels: { colors: t.chart.foreColor },
        },
        dataLabels: { enabled: false },
      };
      const chart = new ApexCharts(el, opts);
      chart.render();
      this.chartRefs.hero = chart;
    },

    renderTreemap() {
      this.destroyChart('tree');
      const el = document.getElementById('treemap');
      if (!el || !this.holdings.length) return;
      const t = this.apexTheme();

      const data = this.holdings
        .filter(h => h.market_value !== null)
        .map(h => ({ x: h.name, y: h.market_value, fillColor: this.tileColor(h.unrealized_pct || 0) }));

      const self = this;
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'treemap', height: 320 },
        series: [{ data }],
        plotOptions: { treemap: { distributed: true, enableShades: false } },
        dataLabels: {
          enabled: true,
          style: { fontSize: '13px', fontWeight: 600, fontFamily: 'Inter' },
          formatter: (text, op) => [text, self.fmtEUR(op.value)],
          offsetY: -4,
        },
        tooltip: {
          ...t.tooltip,
          custom: ({ seriesIndex, dataPointIndex, w }) => {
            const d = w.config.series[seriesIndex].data[dataPointIndex];
            const h = self.holdings.find(x => x.name === d.x);
            if (!h) return '';
            const pct = h.unrealized_pct ?? 0;
            const cls = pct >= 0 ? '#10b981' : '#f43f5e';
            const name = escapeHtml(h.name);
            const mv = escapeHtml(self.fmtEUR(h.market_value));
            const wt = escapeHtml(h.weight.toFixed(1) + '%');
            const pctStr = escapeHtml((pct >= 0 ? '+' : '') + pct.toFixed(2) + '%');
            return `<div class="px-3 py-2 text-xs">
              <div class="font-semibold mb-1">${name}</div>
              <div>Market value: <b>${mv}</b></div>
              <div>Weight: <b>${wt}</b></div>
              <div style="color:${cls}">P&amp;L: <b>${pctStr}</b></div>
            </div>`;
          },
        },
        legend: { show: false },
      });
      chart.render();
      this.chartRefs.tree = chart;
    },

    tileColor(pct) {
      if (pct >= 5)  return '#059669';
      if (pct >= 0)  return '#10b981';
      if (pct >= -5) return '#fb7185';
      return '#e11d48';
    },

    renderCashChart() {
      this.destroyChart('cash');
      const el = document.getElementById('cash-chart');
      if (!el || !this.cashFlow) return;
      const t = this.apexTheme();
      const data = this.cashFlow.balance.map(p => ({ x: p.date, y: p.cash }));
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'area', height: 240 },
        series: [{ name: 'Cash', data }],
        colors: ['#6366f1'],
        stroke: { curve: 'stepline', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0 } },
        xaxis: { ...t.xaxis, type: 'datetime' },
        yaxis: { ...t.yaxis, labels: { ...t.yaxis.labels, formatter: v => this.fmtEUR(v) } },
        tooltip: { ...t.tooltip, x: { format: 'dd MMM yyyy' }, y: { formatter: v => this.fmtEUR(v) } },
        grid: t.grid,
        dataLabels: { enabled: false },
      });
      chart.render();
      this.chartRefs.cash = chart;
    },

    renderBucketChart() {
      this.destroyChart('bucket');
      const el = document.getElementById('bucket-chart');
      if (!el || !this.cashFlow) return;
      const t = this.apexTheme();
      const buckets = this.cashFlow.buckets.filter(b => Math.abs(b.value) > 0.001);
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'bar', height: 280 },
        series: [{
          data: buckets.map(b => ({
            x: b.label,
            y: b.value,
            fillColor: b.value >= 0 ? '#10b981' : '#f43f5e',
          })),
        }],
        plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true, barHeight: '70%' } },
        xaxis: { ...t.xaxis, labels: { ...t.xaxis.labels, formatter: v => this.fmtEUR(v) } },
        yaxis: t.yaxis,
        legend: { show: false },
        tooltip: { ...t.tooltip, y: { formatter: v => this.fmtEUR(v) } },
        grid: t.grid,
        dataLabels: { enabled: false },
      });
      chart.render();
      this.chartRefs.bucket = chart;
    },

    renderHeatmap() {
      this.destroyChart('heatmap');
      const el = document.getElementById('heatmap');
      if (!el || !this.analytics?.monthly) return;
      const t = this.apexTheme();
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const years = Object.keys(this.analytics.monthly).sort();
      const series = years.map(yr => ({
        name: yr,
        data: MONTHS.map(m => ({ x: m, y: this.analytics.monthly[yr]?.[m] ?? null })),
      }));
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'heatmap', height: Math.max(80, years.length * 52) },
        series,
        dataLabels: {
          enabled: true,
          style: { fontSize: '11px', fontWeight: 600, fontFamily: 'Inter' },
          formatter: v => v !== null ? (v > 0 ? '+' : '') + v.toFixed(1) + '%' : '',
        },
        plotOptions: {
          heatmap: {
            radius: 4,
            enableShades: true,
            shadeIntensity: 0.4,
            colorScale: {
              ranges: [
                { from: -100, to: -5,   color: '#e11d48', name: 'Very negative' },
                { from: -5,   to: -0.1, color: '#fb7185', name: 'Negative' },
                { from: -0.1, to:  0.1, color: '#52525b', name: 'Flat' },
                { from:  0.1, to:  5,   color: '#34d399', name: 'Positive' },
                { from:  5,   to: 100,  color: '#059669', name: 'Very positive' },
              ],
            },
          },
        },
        xaxis: { ...t.xaxis },
        tooltip: { ...t.tooltip, y: { formatter: v => v !== null ? (v > 0 ? '+' : '') + v?.toFixed(2) + '%' : '—' } },
        grid: { ...t.grid, padding: { left: 0, right: 0 } },
        legend: { show: false },
      });
      chart.render();
      this.chartRefs.heatmap = chart;
    },

    renderAnnualChart() {
      this.destroyChart('annual');
      const el = document.getElementById('annual-chart');
      if (!el || !this.analytics?.annual?.length) return;
      const t = this.apexTheme();
      const annual = this.analytics.annual;
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'bar', height: 260 },
        series: [{ name: 'P&L', data: annual.map(a => ({ x: String(a.year), y: a.pnl, fillColor: a.pnl >= 0 ? '#10b981' : '#f43f5e' })) }],
        plotOptions: { bar: { borderRadius: 6, distributed: true, columnWidth: '55%' } },
        xaxis: { ...t.xaxis, categories: annual.map(a => a.year) },
        yaxis: { ...t.yaxis, labels: { ...t.yaxis.labels, formatter: v => this.fmtEUR(v) } },
        tooltip: {
          ...t.tooltip,
          y: { formatter: (v, { dataPointIndex: i }) => `${this.fmtEUR(v)} (${annual[i]?.pct >= 0 ? '+' : ''}${annual[i]?.pct?.toFixed(2)}%)` },
        },
        grid: t.grid,
        legend: { show: false },
        dataLabels: {
          enabled: true,
          style: { fontSize: '11px', fontWeight: 600 },
          formatter: (v, { dataPointIndex: i }) => (annual[i]?.pct >= 0 ? '+' : '') + annual[i]?.pct?.toFixed(1) + '%',
        },
      });
      chart.render();
      this.chartRefs.annual = chart;
    },

    renderSectorDonut() {
      this.destroyChart('donut');
      const el = document.getElementById('sector-donut');
      if (!el || !this.analytics?.sectors?.length) return;
      const t = this.apexTheme();
      const sectors = this.analytics.sectors.filter(s => s.value > 0);
      const colorMap = { STOCK: '#0ea5e9', FUND: '#10b981', CRYPTO: '#f59e0b', ETF: '#8b5cf6', BOND: '#06b6d4' };
      const colors = sectors.map(s => colorMap[s.label] || '#71717a');
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'donut', height: 280 },
        series: sectors.map(s => s.value),
        labels: sectors.map(s => s.label || 'Other'),
        colors,
        plotOptions: { pie: { donut: { size: '65%', labels: {
          show: true,
          total: { show: true, label: 'Total', fontSize: '12px', color: t.chart.foreColor, formatter: () => this.fmtEUR(sectors.reduce((a,s) => a + s.value, 0)) },
        } } } },
        dataLabels: { enabled: true, formatter: (v) => v.toFixed(1) + '%', style: { fontSize: '11px', fontWeight: 600 } },
        legend: { position: 'bottom', fontSize: '12px', labels: { colors: t.chart.foreColor } },
        tooltip: { ...t.tooltip, y: { formatter: v => this.fmtEUR(v) } },
      });
      chart.render();
      this.chartRefs.donut = chart;
    },

    renderPnlChart() {
      this.destroyChart('pnl');
      const el = document.getElementById('pnl-chart');
      if (!el || !this.analytics?.pnl_series?.length) return;
      const t = this.apexTheme();
      const data = this.analytics.pnl_series.map(p => ({ x: p.date, y: p.pnl }));
      const positiveColor = '#10b981', negativeColor = '#f43f5e';
      const chart = new ApexCharts(el, {
        chart: { ...t.chart, type: 'area', height: 240 },
        series: [{ name: 'Unrealized P&L', data }],
        colors: [positiveColor],
        stroke: { curve: 'smooth', width: 2 },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'light', type: 'vertical',
            colorStops: [
              [{ offset: 0, color: positiveColor, opacity: 0.35 }, { offset: 100, color: positiveColor, opacity: 0 }],
            ],
          },
        },
        xaxis: { ...t.xaxis, type: 'datetime' },
        yaxis: { ...t.yaxis, labels: { ...t.yaxis.labels, formatter: v => this.fmtEUR(v) } },
        tooltip: { ...t.tooltip, x: { format: 'dd MMM yyyy' }, y: { formatter: v => (v >= 0 ? '+' : '') + this.fmtEUR(v) } },
        grid: t.grid,
        dataLabels: { enabled: false },
        annotations: { yaxis: [{ y: 0, borderColor: '#71717a', borderWidth: 1, strokeDashArray: 3 }] },
      });
      chart.render();
      this.chartRefs.pnl = chart;
    },

    // ── rebalancing ────────────────────────────────────────────────
    setTarget(isin, val) {
      const n = parseFloat(val);
      if (isNaN(n) || n < 0) { delete this.rebalanceTargets[isin]; }
      else { this.rebalanceTargets[isin] = Math.min(100, n); }
      localStorage.setItem('kapital_targets', JSON.stringify(this.rebalanceTargets));
    },

    rebalanceDiff(h) {
      const target = this.rebalanceTargets[h.isin];
      if (target === undefined || target === null || !this.totalMV) return null;
      const targetMV = (target / 100) * this.totalMV;
      const currentMV = h.market_value || 0;
      const diff = targetMV - currentMV;
      return { diff, shares: h.current_price ? Math.abs(diff) / h.current_price : null, action: diff > 0 ? 'Buy' : 'Sell' };
    },

    get totalTargetPct() {
      return Object.values(this.rebalanceTargets).reduce((a, b) => a + b, 0);
    },

    // German Abgeltungsteuer: 25% + 5.5% Soli = 26.375%
    get taxLossOpportunities() {
      const TAX_RATE = 0.26375;
      return this.holdings
        .filter(h => h.unrealized_pnl !== null && h.unrealized_pnl < 0)
        .sort((a, b) => a.unrealized_pnl - b.unrealized_pnl)
        .map(h => ({ ...h, taxSaving: Math.abs(h.unrealized_pnl) * TAX_RATE }));
    },

    get totalTaxSaving() {
      return this.taxLossOpportunities.reduce((a, h) => a + h.taxSaving, 0);
    },

    renderAllSparklines() {
      for (const h of this.holdings) {
        const id = 'spark-' + h.isin.replace(/[^a-z0-9]/gi, '_');
        const data = this.sparklines[h.isin];
        const el = document.getElementById(id);
        if (!el) continue;
        this.destroyChart(id);
        if (!data || data.length < 2) {
          el.textContent = '—';
          el.className = el.className + ' text-[10px] text-ink-500 text-right';
          continue;
        }
        const trend = data[data.length - 1] >= data[0];
        const chart = new ApexCharts(el, {
          chart: { type: 'line', height: 32, width: 100, sparkline: { enabled: true }, animations: { enabled: false } },
          series: [{ data }],
          stroke: { curve: 'smooth', width: 1.75 },
          colors: [trend ? '#10b981' : '#f43f5e'],
          tooltip: { enabled: false },
        });
        chart.render();
        this.chartRefs[id] = chart;
      }
    },
  };
}
