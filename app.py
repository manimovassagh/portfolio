# pyright: reportGeneralTypeIssues=false
"""Trade Republic portfolio dashboard.

Run with:  uv run streamlit run app.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from portfolio import cash, loader, performance, positions, prices

st.set_page_config(
    page_title="Trade Republic Portfolio",
    page_icon="📈",
    layout="wide",
)


# ───────────────────────────────────────── Sidebar: file picker ──────
st.sidebar.title("📁 Export")

exports = loader.list_exports()
if not exports:
    st.error(
        "No CSV files found in `exports/`. "
        "Export a transaction history from Trade Republic and drop the file in there."
    )
    st.stop()

selected_name = st.sidebar.selectbox(
    "Choose an export",
    [p.name for p in exports],
    index=0,
    help="Newest export at the top. Drop new exports into the `exports/` folder.",
)
selected = next(p for p in exports if p.name == selected_name)
st.sidebar.caption(f"Loaded: `{selected.name}`")
st.sidebar.caption(f"{selected.stat().st_size / 1024:.1f} KB")

refresh = st.sidebar.button("🔄 Refresh prices", width="stretch")
st.sidebar.divider()


# ───────────────────────────────────────── Data loading ──────────────
@st.cache_data(show_spinner=False)
def _load_df(path: str, mtime: float) -> pd.DataFrame:
    # mtime is in the cache key so reloads pick up CSV edits
    del mtime
    return loader.load(Path(path))


df = _load_df(str(selected), selected.stat().st_mtime)


@st.cache_data(show_spinner="Fetching live prices...", ttl=900)
def _load_prices(isins: tuple[str, ...], force: bool) -> dict[str, float]:
    return prices.fetch_prices(list(isins), force_refresh=force)


holdings, realized = positions.compute_holdings(df)
holding_isins = tuple(sorted(holdings.keys()))
live_prices = _load_prices(holding_isins, force=refresh)
positions_df = positions.holdings_to_df(holdings, prices=live_prices)
cash_summary = cash.summarize(df)


# ───────────────────────────────────────── Header KPIs ───────────────
total_market_value = positions_df["Market value (EUR)"].fillna(0).sum()
total_cost_basis = positions_df["Cost basis (EUR)"].sum()
total_unrealized = (positions_df["Unrealized P&L (EUR)"].fillna(0)).sum()
total_realized = sum(r.pnl for r in realized)
portfolio_value = total_market_value + cash_summary.cash_balance

st.title("📈 Trade Republic Portfolio")

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Portfolio value", f"€{portfolio_value:,.2f}", help="Holdings + cash")
col2.metric(
    "Net deposits",
    f"€{cash_summary.net_deposits:,.2f}",
    delta=f"€{portfolio_value - cash_summary.net_deposits:+,.2f}",
    help="Deposits − withdrawals. Delta = portfolio − net deposits.",
)
col3.metric(
    "Unrealized P&L",
    f"€{total_unrealized:,.2f}",
    delta=f"{(total_unrealized / total_cost_basis * 100) if total_cost_basis else 0:+.2f}%",
)
col4.metric("Realized P&L", f"€{total_realized:,.2f}")
col5.metric("Cash balance", f"€{cash_summary.cash_balance:,.2f}")


tab_overview, tab_positions, tab_perf, tab_cash, tab_income, tab_realized, tab_tax, tab_dive = st.tabs(
    [
        "Overview",
        "Positions",
        "Performance",
        "Cash flow",
        "Income",
        "Realized P&L",
        "Tax",
        "Deep dive",
    ]
)


# ───────────────────────────────────────── Overview ──────────────────
with tab_overview:
    if positions_df.empty:
        st.info("No open positions yet.")
    else:
        left, right = st.columns(2)
        with left:
            st.subheader("By position")
            pie_df = positions_df.copy()
            pie_df["MV"] = pie_df["Market value (EUR)"].fillna(pie_df["Cost basis (EUR)"])
            fig = px.pie(
                pie_df,
                names="Name",
                values="MV",
                hole=0.5,
            )
            fig.update_traces(textposition="inside", textinfo="percent+label")
            fig.update_layout(showlegend=False, margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig, width="stretch")

        with right:
            st.subheader("By asset class")
            by_class = (
                positions_df.assign(
                    MV=positions_df["Market value (EUR)"].fillna(positions_df["Cost basis (EUR)"])
                )
                .groupby("Asset class", as_index=False)["MV"]
                .sum()
            )
            fig2 = px.pie(by_class, names="Asset class", values="MV", hole=0.5)
            fig2.update_traces(textposition="inside", textinfo="percent+label")
            fig2.update_layout(showlegend=False, margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig2, width="stretch")

        st.subheader("Quick numbers")
        a, b, c, d = st.columns(4)
        a.metric("Total deposits", f"€{cash_summary.deposits:,.2f}")
        b.metric("Total invested (gross)", f"€{cash_summary.invested:,.2f}")
        c.metric("Dividends received", f"€{cash_summary.dividends:,.2f}")
        d.metric("Interest received", f"€{cash_summary.interest:,.2f}")
        e, f, g, h_ = st.columns(4)
        e.metric("Stock perks", f"€{cash_summary.stockperks:,.2f}")
        f.metric("Fees paid", f"€{cash_summary.fees:,.2f}")
        g.metric("Tax withheld", f"€{cash_summary.tax:,.2f}")
        h_.metric("Total income", f"€{cash_summary.total_income:,.2f}")


# ───────────────────────────────────────── Positions ─────────────────
with tab_positions:
    st.subheader("Current holdings")
    missing = [isin for isin in holding_isins if isin not in live_prices]
    if missing:
        st.warning(
            f"Could not fetch live price for: {', '.join(missing)}. "
            "Edit `portfolio/prices.py` (`KNOWN_TICKERS`) to add a Yahoo ticker mapping."
        )

    st.dataframe(
        positions_df.style.format(
            {
                "Shares": "{:.4f}",
                "Avg cost (EUR)": "€{:.2f}",
                "Cost basis (EUR)": "€{:.2f}",
                "Current price (EUR)": "€{:.2f}",
                "Market value (EUR)": "€{:.2f}",
                "Unrealized P&L (EUR)": "€{:.2f}",
                "Unrealized P&L %": "{:+.2f}%",
                "Realized P&L (EUR)": "€{:.2f}",
                "Fees paid (EUR)": "€{:.2f}",
            },
            na_rep="—",
        ),
        width="stretch",
        hide_index=True,
    )


# ───────────────────────────────────────── Performance ───────────────
with tab_perf:
    st.subheader("Portfolio value vs contributions")
    with st.spinner("Loading historical prices..."):
        perf = performance.performance_series(df)
    if perf.empty:
        st.info("Not enough data to plot performance.")
    else:
        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=perf.index, y=perf["portfolio_value"], name="Portfolio value", line=dict(width=3)
            )
        )
        fig.add_trace(
            go.Scatter(
                x=perf.index,
                y=perf["contributions"],
                name="Net deposits",
                line=dict(dash="dash"),
            )
        )
        if "holdings_value" in perf.columns:
            fig.add_trace(
                go.Scatter(
                    x=perf.index, y=perf["holdings_value"], name="Holdings only", opacity=0.6
                )
            )
        fig.update_layout(
            yaxis_title="EUR",
            xaxis_title="",
            hovermode="x unified",
            margin=dict(l=0, r=0, t=10, b=0),
        )
        st.plotly_chart(fig, width="stretch")

        latest = perf.iloc[-1]
        a, b, c = st.columns(3)
        a.metric("Latest portfolio value", f"€{latest['portfolio_value']:,.2f}")
        b.metric("Latest contributions", f"€{latest['contributions']:,.2f}")
        diff = latest["portfolio_value"] - latest["contributions"]
        c.metric("Above/below deposits", f"€{diff:+,.2f}")


# ───────────────────────────────────────── Cash flow ─────────────────
with tab_cash:
    st.subheader("Cash balance over time")
    bal = cash.cash_balance_over_time(df)
    fig = px.area(bal, x="date", y="cash")
    fig.update_layout(yaxis_title="EUR", xaxis_title="", margin=dict(l=0, r=0, t=10, b=0))
    st.plotly_chart(fig, width="stretch")

    st.subheader("Inflows & outflows")
    flow_summary = pd.DataFrame(
        [
            {"Bucket": "Deposits", "EUR": cash_summary.deposits},
            {"Bucket": "Withdrawals", "EUR": -cash_summary.withdrawals},
            {"Bucket": "Dividends", "EUR": cash_summary.dividends},
            {"Bucket": "Interest", "EUR": cash_summary.interest},
            {"Bucket": "Stock perks", "EUR": cash_summary.stockperks},
            {"Bucket": "Fees", "EUR": -cash_summary.fees},
            {"Bucket": "Tax", "EUR": -cash_summary.tax},
            {"Bucket": "Net invested in markets", "EUR": -cash_summary.invested},
        ]
    )
    fig2 = px.bar(
        flow_summary,
        x="Bucket",
        y="EUR",
        color="EUR",
        color_continuous_scale=["#d63031", "#dfe6e9", "#00b894"],
    )
    fig2.update_layout(showlegend=False, coloraxis_showscale=False, margin=dict(l=0, r=0, t=10, b=0))
    st.plotly_chart(fig2, width="stretch")


# ───────────────────────────────────────── Income ────────────────────
with tab_income:
    st.subheader("Dividends, interest & perks")
    log = cash.income_log(df)
    if log.empty:
        st.info("No income events yet.")
    else:
        a, b, c = st.columns(3)
        a.metric("Dividends", f"€{cash_summary.dividends:,.2f}")
        b.metric("Interest", f"€{cash_summary.interest:,.2f}")
        c.metric("Stock perks", f"€{cash_summary.stockperks:,.2f}")

        st.dataframe(
            log.style.format({"Amount (EUR)": "€{:.2f}", "Tax (EUR)": "€{:.2f}"}, na_rep="—"),
            width="stretch",
            hide_index=True,
        )


# ───────────────────────────────────────── Realized P&L ──────────────
with tab_realized:
    st.subheader("Realized trades")
    if not realized:
        st.info("No sells yet. Realized P&L appears here once you close a position.")
    else:
        r_df = pd.DataFrame(
            [
                {
                    "Date": r.date.date() if pd.notna(r.date) else None,
                    "Asset": r.name,
                    "ISIN": r.isin,
                    "Shares sold": r.shares,
                    "Sell price (EUR)": r.sell_price,
                    "Avg cost (EUR)": r.avg_cost,
                    "P&L (EUR)": r.pnl,
                    "P&L %": (r.sell_price - r.avg_cost) / r.avg_cost * 100 if r.avg_cost else 0,
                }
                for r in realized
            ]
        )
        st.dataframe(
            r_df.style.format(
                {
                    "Shares sold": "{:.4f}",
                    "Sell price (EUR)": "€{:.2f}",
                    "Avg cost (EUR)": "€{:.2f}",
                    "P&L (EUR)": "€{:.2f}",
                    "P&L %": "{:+.2f}%",
                }
            ),
            width="stretch",
            hide_index=True,
        )
        st.metric("Total realized P&L", f"€{r_df['P&L (EUR)'].sum():,.2f}")


# ───────────────────────────────────────── Tax view ──────────────────
with tab_tax:
    st.subheader("Tax-relevant events")
    st.caption(
        "Vorabpauschale (annual pre-tax on accumulating ETFs), "
        "withholding tax on dividends, and capital-gains tax on sales."
    )
    tax_df = cash.tax_view(df)
    if tax_df.empty:
        st.info("No tax-relevant events yet.")
    else:
        st.dataframe(
            tax_df.style.format({"Amount (EUR)": "€{:.2f}", "Tax (EUR)": "€{:.2f}"}),
            width="stretch",
            hide_index=True,
        )
        a, b = st.columns(2)
        a.metric("Total tax withheld", f"€{tax_df['Tax (EUR)'].sum():,.2f}")
        vp = tax_df[tax_df["Type"] == "EARNINGS"]["Tax (EUR)"].sum()
        b.metric("Of which Vorabpauschale", f"€{vp:,.2f}")


# ───────────────────────────────────────── Deep dive ─────────────────
with tab_dive:
    st.subheader("Per-asset transaction history")
    asset_options = sorted(
        df.loc[df["symbol"] != "", ["symbol", "name"]].drop_duplicates().itertuples(index=False),
        key=lambda t: t.name,
    )
    if not asset_options:
        st.info("No assets in this export yet.")
    else:
        label_to_isin = {f"{n}  ({s})": s for s, n in asset_options}
        choice = st.selectbox("Pick an asset", list(label_to_isin.keys()))
        isin = label_to_isin[choice]
        subset = df[df["symbol"] == isin].copy()
        subset["Date"] = subset["date"].dt.date
        cols = [
            "Date",
            "type",
            "shares",
            "price",
            "amount",
            "fee",
            "tax",
            "description",
            "transaction_id",
        ]
        existing = [c for c in cols if c in subset.columns]
        st.dataframe(subset[existing], width="stretch", hide_index=True)

        if isin in live_prices:
            h = holdings.get(isin)
            if h:
                cur = live_prices[isin]
                mv = cur * h.shares
                pnl = mv - h.cost_basis
                a, b, c, d = st.columns(4)
                a.metric("Shares held", f"{h.shares:.4f}")
                b.metric("Avg cost", f"€{h.avg_cost:.2f}")
                c.metric("Current price", f"€{cur:.2f}")
                d.metric("Unrealized P&L", f"€{pnl:+,.2f}", delta=f"{pnl/h.cost_basis*100:+.2f}%")
