"""
Parameter optimization for top strategies using backtesting.py's built-in optimizer.
Tests V2 (Bollinger Bounce) and V8 (Adaptive Cycle) with parameter grids.
"""
import sys
import os
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from backtesting import Backtest

sys.path.insert(0, os.path.dirname(__file__))

from strategies.v2_bollinger_bounce import BollingerBounce
from strategies.v8_adaptive_cycle import AdaptiveCycle


def load_data():
    df = pd.read_csv(
        os.path.join(os.path.dirname(__file__), 'data', 'spy_daily.csv'),
        header=[0, 1], index_col=0, parse_dates=True
    )
    df.columns = df.columns.get_level_values(0)
    df = df.dropna()
    return df


def safe_val(val, default=0):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return default
    return val


def optimize_v2(data):
    """Optimize Bollinger Bounce parameters."""
    print("=" * 100)
    print("  OPTIMIZING V2: Bollinger Bounce")
    print("=" * 100)

    bt = Backtest(data, BollingerBounce, cash=10000, commission=0.001,
                  exclusive_orders=True, trade_on_close=True)

    stats = bt.optimize(
        bb_period=range(15, 35, 5),
        bb_std=[1.5, 2.0, 2.5],
        buy_threshold=[x / 100 for x in range(-10, 20, 5)],
        sell_threshold=[x / 100 for x in range(80, 110, 5)],
        maximize='Sharpe Ratio',
        return_optimization=False,
    )

    print(f"\n  Best params:")
    print(f"    bb_period = {stats._strategy.bb_period}")
    print(f"    bb_std = {stats._strategy.bb_std}")
    print(f"    buy_threshold = {stats._strategy.buy_threshold}")
    print(f"    sell_threshold = {stats._strategy.sell_threshold}")
    print(f"\n  Results:")
    print(f"    Return: {stats['Return [%]']:.2f}%")
    print(f"    Sharpe: {safe_val(stats.get('Sharpe Ratio', 0)):.3f}")
    print(f"    Sortino: {safe_val(stats.get('Sortino Ratio', 0)):.3f}")
    print(f"    Max DD: {stats['Max. Drawdown [%]']:.2f}%")
    print(f"    Win Rate: {safe_val(stats['Win Rate [%]']):.1f}%")
    print(f"    # Trades: {stats['# Trades']}")
    print(f"    Profit Factor: {safe_val(stats.get('Profit Factor', 0)):.2f}")
    print(f"    Exposure: {stats['Exposure Time [%]']:.1f}%")
    return stats


def optimize_v8(data):
    """Optimize Adaptive Cycle parameters."""
    print("\n" + "=" * 100)
    print("  OPTIMIZING V8: Adaptive Cycle")
    print("=" * 100)

    bt = Backtest(data, AdaptiveCycle, cash=10000, commission=0.001,
                  exclusive_orders=True, trade_on_close=True)

    stats = bt.optimize(
        sma_trend=[100, 150, 200],
        stop_loss_pct=[0.04, 0.06, 0.08, 0.10],
        sell_rsi=[65, 70, 75, 80],
        sell_bb=[0.80, 0.85, 0.90, 0.95],
        maximize='Sharpe Ratio',
        return_optimization=False,
    )

    print(f"\n  Best params:")
    print(f"    sma_trend = {stats._strategy.sma_trend}")
    print(f"    stop_loss_pct = {stats._strategy.stop_loss_pct}")
    print(f"    sell_rsi = {stats._strategy.sell_rsi}")
    print(f"    sell_bb = {stats._strategy.sell_bb}")
    print(f"\n  Results:")
    print(f"    Return: {stats['Return [%]']:.2f}%")
    print(f"    Sharpe: {safe_val(stats.get('Sharpe Ratio', 0)):.3f}")
    print(f"    Sortino: {safe_val(stats.get('Sortino Ratio', 0)):.3f}")
    print(f"    Max DD: {stats['Max. Drawdown [%]']:.2f}%")
    print(f"    Win Rate: {safe_val(stats['Win Rate [%]']):.1f}%")
    print(f"    # Trades: {stats['# Trades']}")
    print(f"    Profit Factor: {safe_val(stats.get('Profit Factor', 0)):.2f}")
    print(f"    Exposure: {stats['Exposure Time [%]']:.1f}%")
    return stats


if __name__ == '__main__':
    data = load_data()
    print(f"  Data: SPY | {len(data)} bars | {data.index[0].date()} to {data.index[-1].date()}\n")

    v2_stats = optimize_v2(data)
    v8_stats = optimize_v8(data)

    print("\n" + "=" * 100)
    print("  OPTIMIZATION COMPLETE")
    print("=" * 100)
