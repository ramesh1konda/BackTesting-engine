"""
Run ALL strategy versions (V1-V9 + optimized variants) against S&P 500 (SPY).
Final comprehensive comparison.
"""
import sys
import os
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from backtesting import Backtest

sys.path.insert(0, os.path.dirname(__file__))

from strategies.v1_rsi_mean_reversion import RSIMeanReversion
from strategies.v2_bollinger_bounce import BollingerBounce
from strategies.v3_ma_rsi_combo import MARSICombo
from strategies.v4_multi_timeframe import MultiTimeframeMR
from strategies.v5_composite_cycle import CompositeCycleStrategy
from strategies.v6_bb_enhanced import BBEnhanced
from strategies.v7_composite_enhanced import CompositeEnhanced
from strategies.v8_adaptive_cycle import AdaptiveCycle
from strategies.v9_ultimate_cycle import UltimateCycle


def load_data():
    df = pd.read_csv(
        os.path.join(os.path.dirname(__file__), 'data', 'spy_daily.csv'),
        header=[0, 1], index_col=0, parse_dates=True
    )
    df.columns = df.columns.get_level_values(0)
    df = df.dropna()
    return df


def run_single(name, strategy_cls, data, cash=10000, commission=0.001, **kwargs):
    bt = Backtest(data, strategy_cls, cash=cash, commission=commission,
                  exclusive_orders=True, trade_on_close=True)
    stats = bt.run(**kwargs)
    return stats


def safe_val(val, default=0):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    return val


def format_stats(stats):
    return {
        'Return [%]': round(safe_val(stats['Return [%]']), 2),
        'B&H Return [%]': round(safe_val(stats['Buy & Hold Return [%]']), 2),
        'Max DD [%]': round(safe_val(stats['Max. Drawdown [%]']), 2),
        'Sharpe': round(safe_val(stats.get('Sharpe Ratio', 0)), 3),
        'Sortino': round(safe_val(stats.get('Sortino Ratio', 0)), 3),
        'Calmar': round(safe_val(stats.get('Calmar Ratio', 0)), 3),
        'Win Rate [%]': round(safe_val(stats['Win Rate [%]']), 1),
        '# Trades': int(safe_val(stats['# Trades'])),
        'Avg Trade [%]': round(safe_val(stats.get('Avg. Trade [%]', 0)), 2),
        'Profit Factor': round(safe_val(stats.get('Profit Factor', 0)), 2),
        'Exposure [%]': round(safe_val(stats['Exposure Time [%]']), 1),
        'Final Equity [$]': round(safe_val(stats['Equity Final [$]']), 2),
    }


def compute_score(r):
    """
    Composite score weighting:
    - Return: 20% (absolute performance)
    - Risk-adjusted: 30% (Sharpe + Sortino)
    - Drawdown: 20% (capital protection)
    - Consistency: 15% (win rate + profit factor)
    - Efficiency: 15% (return per unit of exposure)
    """
    exposure = max(r['Exposure [%]'], 1)
    return_per_exposure = r['Return [%]'] / exposure * 100

    score = (
        r['Return [%]'] / 100 * 20 +           # Normalize return contribution
        r['Sharpe'] * 30 +                       # Sharpe (already ~0-2 range)
        r['Sortino'] * 15 +                      # Sortino
        -r['Max DD [%]'] / 100 * 20 +           # Drawdown penalty (negative value)
        r['Win Rate [%]'] / 100 * 10 +          # Win rate
        min(r['Profit Factor'], 10) * 1.5 +     # Profit factor (capped)
        return_per_exposure / 100 * 15           # Efficiency
    )
    return round(score, 2)


def main():
    print("=" * 130)
    print("  S&P 500 CYCLE STRATEGY BACKTEST - FINAL COMPARISON (V1-V9 + Optimized)")
    print("=" * 130)

    data = load_data()
    print(f"\n  Data: SPY | {len(data)} bars | {data.index[0].date()} to {data.index[-1].date()}")
    print(f"  Starting Capital: $10,000 | Commission: 0.1%\n")

    # All strategies including optimized parameter variants
    strategies = [
        ('V1: RSI Mean Reversion', RSIMeanReversion, {}),
        ('V2: Bollinger Bounce', BollingerBounce, {}),
        ('V2-OPT: BB Optimized', BollingerBounce,
         {'bb_period': 20, 'bb_std': 2.5, 'buy_threshold': -0.1, 'sell_threshold': 0.9}),
        ('V3: MA + RSI Combo', MARSICombo, {}),
        ('V4: Multi-TF MR', MultiTimeframeMR, {}),
        ('V5: Composite Cycle', CompositeCycleStrategy, {}),
        ('V6: BB Enhanced', BBEnhanced, {}),
        ('V7: Composite Enhanced', CompositeEnhanced, {}),
        ('V8: Adaptive Cycle', AdaptiveCycle, {}),
        ('V8-OPT: Adaptive Optimized', AdaptiveCycle,
         {'sma_trend': 200, 'stop_loss_pct': 0.08, 'sell_rsi': 80, 'sell_bb': 0.95}),
        ('V9: Ultimate Cycle', UltimateCycle, {}),
    ]

    all_results = {}
    for name, strat_cls, kwargs in strategies:
        try:
            stats = run_single(name, strat_cls, data, **kwargs)
            all_results[name] = format_stats(stats)
            print(f"  [OK] {name}")
        except Exception as e:
            print(f"  [ERR] {name}: {e}")

    # ===== COMPARISON TABLE =====
    print("\n" + "=" * 130)
    print("  RESULTS TABLE")
    print("=" * 130)

    df = pd.DataFrame(all_results).T
    df.index.name = 'Strategy'
    print(df.to_string())

    # ===== SCORING & RANKING =====
    print("\n" + "=" * 130)
    print("  FINAL RANKINGS (Composite Score)")
    print("=" * 130)

    scores = {name: compute_score(r) for name, r in all_results.items()}
    sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    print(f"\n  {'Rank':<5} {'Strategy':<35} {'Score':>8} {'Return%':>10} {'Sharpe':>8} "
          f"{'Sortino':>8} {'MaxDD%':>8} {'WinRate%':>9} {'Trades':>7} {'PF':>6} {'Exposure%':>10}")
    print("  " + "-" * 120)

    for rank, (name, score) in enumerate(sorted_results, 1):
        r = all_results[name]
        marker = " <<<" if rank == 1 else ""
        print(f"  #{rank:<4} {name:<35} {score:>8.2f} {r['Return [%]']:>10.2f} {r['Sharpe']:>8.3f} "
              f"{r['Sortino']:>8.3f} {r['Max DD [%]']:>8.2f} {r['Win Rate [%]']:>9.1f} "
              f"{r['# Trades']:>7} {r['Profit Factor']:>6.2f} {r['Exposure [%]']:>10.1f}{marker}")

    winner_name = sorted_results[0][0]
    winner_r = all_results[winner_name]

    print("\n" + "*" * 130)
    print(f"  BEST STRATEGY: {winner_name}")
    print(f"  Return: {winner_r['Return [%]']}% | Sharpe: {winner_r['Sharpe']} | "
          f"Sortino: {winner_r['Sortino']} | Max DD: {winner_r['Max DD [%]']}% | "
          f"Win Rate: {winner_r['Win Rate [%]']}% | Profit Factor: {winner_r['Profit Factor']}")
    print(f"  Final Equity: ${winner_r['Final Equity [$]']:,.2f} (from $10,000)")
    print("*" * 130)

    # Save
    results_path = os.path.join(os.path.dirname(__file__), 'results', 'final_comparison.csv')
    df['Score'] = df.index.map(scores)
    df = df.sort_values('Score', ascending=False)
    df.to_csv(results_path)
    print(f"\n  Results saved to: {results_path}")


if __name__ == '__main__':
    main()
