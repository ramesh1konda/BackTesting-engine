"""
Strategy V7: Enhanced Composite Cycle (builds on V5)
Key changes from V5:
  - Higher buy threshold (30 vs 20) for more trades
  - Trend filter uses 150-SMA (faster to adapt)
  - Stop loss for protection
  - Sell when composite reaches overbought OR trend breaks
"""
from backtesting import Strategy
import numpy as np


def SMA(series, period):
    out = np.full_like(series, np.nan)
    for i in range(period - 1, len(series)):
        out[i] = np.mean(series[i - period + 1:i + 1])
    return out


def RSI(series, period=14):
    delta = np.diff(series)
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    avg_gain = np.full_like(series, np.nan)
    avg_loss = np.full_like(series, np.nan)
    avg_gain[period] = np.mean(gain[:period])
    avg_loss[period] = np.mean(loss[:period])
    for i in range(period + 1, len(series)):
        avg_gain[i] = (avg_gain[i-1] * (period - 1) + gain[i-1]) / period
        avg_loss[i] = (avg_loss[i-1] * (period - 1) + loss[i-1]) / period
    rs = avg_gain / np.where(avg_loss == 0, 1e-10, avg_loss)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def BollingerPctB(close, period=20, num_std=2.0):
    sma = SMA(close, period)
    std = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        std[i] = np.std(close[i - period + 1:i + 1], ddof=1)
    upper = sma + num_std * std
    lower = sma - num_std * std
    band_width = upper - lower
    pct_b = np.where(band_width > 0, (close - lower) / band_width, 0.5)
    pct_b[:period - 1] = np.nan
    return pct_b * 100


def StochasticK(high, low, close, period=14):
    out = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        hh = np.max(high[i - period + 1:i + 1])
        ll = np.min(low[i - period + 1:i + 1])
        if hh - ll > 0:
            out[i] = 100 * (close[i] - ll) / (hh - ll)
        else:
            out[i] = 50.0
    return out


def CompositeScore(close, high, low):
    """Simplified composite: RSI + BB%B + Stochastic (equally weighted)."""
    rsi = RSI(close, 14)
    bb_pctb = BollingerPctB(close, 20, 2.0)
    stoch = StochasticK(high, low, close, 14)
    composite = np.full_like(close, np.nan)
    for i in range(len(close)):
        vals = [rsi[i], bb_pctb[i], stoch[i]]
        if all(not np.isnan(v) for v in vals):
            composite[i] = np.mean(vals)
    return composite


class CompositeEnhanced(Strategy):
    buy_threshold = 30
    sell_threshold = 70
    sma_trend = 150
    stop_loss_pct = 0.07

    def init(self):
        self.score = self.I(CompositeScore, self.data.Close, self.data.High, self.data.Low)
        self.sma_long = self.I(SMA, self.data.Close, self.sma_trend)
        self.entry_price = 0

    def next(self):
        if np.isnan(self.score[-1]) or np.isnan(self.sma_long[-1]):
            return

        price = self.data.Close[-1]
        in_uptrend = price > self.sma_long[-1]

        if not self.position:
            # Buy when composite oversold and in uptrend
            if self.score[-1] < self.buy_threshold and in_uptrend:
                self.buy()
                self.entry_price = price
        else:
            hit_stop = price < self.entry_price * (1 - self.stop_loss_pct)
            hit_target = self.score[-1] > self.sell_threshold
            trend_break = not in_uptrend

            if hit_stop or hit_target or trend_break:
                self.position.close()
                self.entry_price = 0
