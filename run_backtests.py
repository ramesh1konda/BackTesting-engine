"""
Run all cycle-based strategies against S&P 500 (SPY) data and compare results.
"""
import sys
import os
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from backtesting import Backtest

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from strategies.v1_rsi_mean_reversion import RSIMeanReversion
from strategies.v2_bollinger_bounce import BollingerBounce
from strategies.v3_ma_rsi_combo import MARSICombo
from strategies.v4_multi_timeframe import MultiTimeframeMR
from strategies.v5_composite_cycle import CompositeCycleStrategy


def load_data():
    """Load SPY data in format expected by backtesting.py."""
    df = pd.read_csv(
        os.path.join(os.path.dirname(__file__), 'data', 'spy_daily.csv'),
        header=[0, 1], index_col=0, parse_dates=True
    )
    df.columns = df.columns.get_level_values(0)
    df = df.dropna()
    return df


def run_single(name, strategy_cls, data, cash=10000, commission=0.001, **kwargs):
    """Run a single backtest and return stats."""
    bt = Backtest(data, strategy_cls, cash=cash, commission=commission,
                  exclusive_orders=True, trade_on_close=True)
    stats = bt.run(**kwargs)
    return stats


def format_stats(stats):
    """Extract key metrics from backtest stats."""
    return {
        'Return [%]': round(stats['Return [%]'], 2),
        'Buy & Hold Return [%]': round(stats['Buy & Hold Return [%]'], 2),
        'Max Drawdown [%]': round(stats['Max. Drawdown [%]'], 2),
        'Sharpe Ratio': round(stats.get('Sharpe Ratio', 0) or 0, 3),
        'Sortino Ratio': round(stats.get('Sortino Ratio', 0) or 0, 3),
        'Win Rate [%]': round(stats['Win Rate [%]'], 1) if not pd.isna(stats['Win Rate [%]']) else 0,
        '# Trades': stats['# Trades'],
        'Avg Trade [%]': round(stats.get('Avg. Trade [%]', 0) or 0, 2),
        'Profit Factor': round(stats.get('Profit Factor', 0) or 0, 2),
        'Exposure [%]': round(stats['Exposure Time [%]'], 1),
        'Final Equity': round(stats['Equity Final [$]'], 2),
    }


def print_divider(char='=', width=100):
    print(char * width)


def main():
    print("Loading SPY data...")
    data = load_data()
    print(f"Data: {len(data)} rows, {data.index[0].date()} to {data.index[-1].date()}\n")

    strategies = {
        'V1: RSI Mean Reversion': (RSIMeanReversion, {}),
        'V2: Bollinger Bounce': (BollingerBounce, {}),
        'V3: MA + RSI Combo': (MARSICombo, {}),
        'V4: Multi-TF Mean Reversion': (MultiTimeframeMR, {}),
        'V5: Composite Cycle': (CompositeCycleStrategy, {}),
    }

    all_results = {}
    all_stats = {}

    for name, (strat_cls, kwargs) in strategies.items():
        print_divider()
        print(f"  {name}")
        print_divider()
        try:
            stats = run_single(name, strat_cls, data, **kwargs)
            metrics = format_stats(stats)
            all_results[name] = metrics
            all_stats[name] = stats

            for k, v in metrics.items():
                print(f"  {k:30s}: {v}")
            print()
        except Exception as e:
            print(f"  ERROR: {e}\n")

    # ===== COMPARISON TABLE =====
    print_divider('=', 120)
    print("  COMPARISON SUMMARY")
    print_divider('=', 120)

    if not all_results:
        print("No results to compare.")
        return

    comparison = pd.DataFrame(all_results).T
    comparison.index.name = 'Strategy'

    # Print formatted table
    print(comparison.to_string())
    print()

    # ===== RANKING =====
    print_divider('-', 120)
    print("  RANKINGS (Best to Worst)")
    print_divider('-', 120)

    # Rank by multiple criteria
    rankings = {}
    for name in all_results:
        r = all_results[name]
        # Score: weighted combination of key metrics
        score = (
            r['Return [%]'] * 0.25 +                      # Total return matters
            (r['Return [%]'] - r['Buy & Hold Return [%]']) * 0.15 +  # Alpha over B&H
            -r['Max Drawdown [%]'] * 0.20 +                # Lower drawdown is better
            r['Sharpe Ratio'] * 100 * 0.20 +               # Risk-adjusted return
            r['Win Rate [%]'] * 0.10 +                     # Win rate
            r['Profit Factor'] * 10 * 0.10                 # Profit factor
        )
        rankings[name] = round(score, 2)

    sorted_rankings = sorted(rankings.items(), key=lambda x: x[1], reverse=True)

    for rank, (name, score) in enumerate(sorted_rankings, 1):
        r = all_results[name]
        print(f"  #{rank} {name:35s} | Score: {score:8.2f} | "
              f"Return: {r['Return [%]']:8.2f}% | "
              f"Sharpe: {r['Sharpe Ratio']:6.3f} | "
              f"MaxDD: {r['Max Drawdown [%]']:7.2f}% | "
              f"Trades: {r['# Trades']:4d} | "
              f"WinRate: {r['Win Rate [%]']:5.1f}%")

    print()
    winner = sorted_rankings[0][0]
    print_divider('*', 120)
    print(f"  WINNER: {winner}")
    print_divider('*', 120)

    # Save results to CSV
    results_path = os.path.join(os.path.dirname(__file__), 'results', 'comparison.csv')
    comparison.to_csv(results_path)
    print(f"\n  Results saved to: {results_path}")


if __name__ == '__main__':
    main()
