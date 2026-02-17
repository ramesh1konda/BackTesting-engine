"""
Strategy V9: Ultimate Cycle Strategy
Combines the best findings from optimization:
  - From V2-optimized: wider BB (2.5 std), deeper buy threshold (-0.1), sell at 0.9
  - From V8-optimized: SMA 200 trend filter, 8% stop loss, sell RSI 80, sell BB 0.95
  - Adaptive volatility regime from V8
  - Multiple oscillator confirmation (2 of 3 must agree)
  - Patience: let winners run longer (higher sell thresholds)
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


def BollingerPctB(close, period=20, num_std=2.5):
    """Using wider 2.5 std bands (from V2 optimization)."""
    sma = SMA(close, period)
    std = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        std[i] = np.std(close[i - period + 1:i + 1], ddof=1)
    upper = sma + num_std * std
    lower = sma - num_std * std
    band_width = upper - lower
    pct_b = np.where(band_width > 0, (close - lower) / band_width, 0.5)
    pct_b[:period - 1] = np.nan
    return pct_b


def BBWidth(close, period=20, num_std=2.5):
    sma = SMA(close, period)
    std = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        std[i] = np.std(close[i - period + 1:i + 1], ddof=1)
    width = np.where(sma > 0, (2 * num_std * std) / sma * 100, np.nan)
    width[:period - 1] = np.nan
    return width


def BBWidthPercentile(close, period=20, num_std=2.5, lookback=252):
    width = BBWidth(close, period, num_std)
    out = np.full_like(close, np.nan)
    for i in range(lookback, len(close)):
        window = width[i - lookback + 1:i + 1]
        valid = window[~np.isnan(window)]
        if len(valid) > 20 and not np.isnan(width[i]):
            out[i] = 100 * np.sum(valid < width[i]) / len(valid)
    return out


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


class UltimateCycle(Strategy):
    # Trend filter (from V8 optimization)
    sma_trend = 200

    # BB params (from V2 optimization: wider bands)
    bb_period = 20
    bb_std = 2.5

    # RSI
    rsi_period = 14

    # Stochastic
    stoch_period = 14

    # Entry: deep oversold required (from V2 optimization)
    buy_bb = -0.05        # Below lower BB (very oversold)

    # Exit: let winners run (from V8 optimization)
    sell_bb = 0.90
    sell_rsi = 80

    # Risk management (from V8 optimization)
    stop_loss_pct = 0.08

    def init(self):
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)
        self.pct_b = self.I(BollingerPctB, self.data.Close, self.bb_period, self.bb_std)
        self.vol_pctile = self.I(BBWidthPercentile, self.data.Close, self.bb_period, self.bb_std, 252)
        self.sma_filter = self.I(SMA, self.data.Close, self.sma_trend)
        self.stoch = self.I(StochasticK, self.data.High, self.data.Low, self.data.Close, self.stoch_period)
        self.entry_price = 0

    def next(self):
        if (np.isnan(self.rsi[-1]) or np.isnan(self.pct_b[-1]) or
            np.isnan(self.sma_filter[-1]) or np.isnan(self.vol_pctile[-1])):
            return

        price = self.data.Close[-1]
        in_uptrend = price > self.sma_filter[-1]
        vol_pct = self.vol_pctile[-1]

        # Adaptive entry thresholds
        if vol_pct < 30:
            # Low vol: slightly more aggressive
            buy_rsi = 35
            buy_bb = self.buy_bb + 0.10
            buy_stoch = 25
        elif vol_pct > 70:
            # High vol: require deeper oversold
            buy_rsi = 25
            buy_bb = self.buy_bb
            buy_stoch = 15
        else:
            buy_rsi = 30
            buy_bb = self.buy_bb + 0.05
            buy_stoch = 20

        if not self.position:
            # Count oversold signals
            signals = 0
            if self.rsi[-1] < buy_rsi:
                signals += 1
            if self.pct_b[-1] < buy_bb:
                signals += 1
            if self.stoch[-1] < buy_stoch:
                signals += 1

            # Buy if at least 2 oscillators agree AND uptrend
            if signals >= 2 and in_uptrend:
                self.buy()
                self.entry_price = price
        else:
            hit_stop = price < self.entry_price * (1 - self.stop_loss_pct)
            hit_rsi = self.rsi[-1] > self.sell_rsi
            hit_bb = self.pct_b[-1] > self.sell_bb
            trend_break = not in_uptrend

            if hit_stop or hit_rsi or hit_bb or trend_break:
                self.position.close()
                self.entry_price = 0
