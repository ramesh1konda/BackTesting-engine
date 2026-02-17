"""
Strategy V8: Adaptive Cycle Strategy
Adapts entry thresholds based on volatility regime:
  - Low vol regime: more aggressive entries (catch smaller dips)
  - High vol regime: deeper oversold required (avoid catching falling knives)
Uses BB width percentile to measure volatility regime.
Combines RSI + BB%B + Stochastic for entry, with adaptive thresholds.
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
    return pct_b


def BBWidth(close, period=20, num_std=2.0):
    sma = SMA(close, period)
    std = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        std[i] = np.std(close[i - period + 1:i + 1], ddof=1)
    width = np.where(sma > 0, (2 * num_std * std) / sma * 100, np.nan)
    width[:period - 1] = np.nan
    return width


def BBWidthPercentile(close, period=20, num_std=2.0, lookback=252):
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


class AdaptiveCycle(Strategy):
    sma_trend = 150
    rsi_period = 14
    bb_period = 20
    stoch_period = 14
    stop_loss_pct = 0.06
    sell_rsi = 70
    sell_bb = 0.90

    def init(self):
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)
        self.pct_b = self.I(BollingerPctB, self.data.Close, self.bb_period, 2.0)
        self.vol_pctile = self.I(BBWidthPercentile, self.data.Close, self.bb_period, 2.0, 252)
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

        # Adaptive thresholds based on volatility regime
        if vol_pct < 30:
            # Low vol: tighter bands, need less extreme oversold
            buy_rsi = 40
            buy_bb = 0.15
            buy_stoch = 30
        elif vol_pct > 70:
            # High vol: wider bands, need more extreme oversold
            buy_rsi = 25
            buy_bb = 0.05
            buy_stoch = 15
        else:
            buy_rsi = 35
            buy_bb = 0.10
            buy_stoch = 25

        if not self.position:
            # Count how many oscillators signal oversold
            signals = 0
            if self.rsi[-1] < buy_rsi:
                signals += 1
            if self.pct_b[-1] < buy_bb:
                signals += 1
            if self.stoch[-1] < buy_stoch:
                signals += 1

            # Buy if at least 2 oscillators agree AND we're in an uptrend
            if signals >= 2 and in_uptrend:
                self.buy()
                self.entry_price = price
        else:
            hit_stop = price < self.entry_price * (1 - self.stop_loss_pct)
            hit_rsi_target = self.rsi[-1] > self.sell_rsi
            hit_bb_target = self.pct_b[-1] > self.sell_bb
            trend_break = not in_uptrend

            if hit_stop or hit_rsi_target or hit_bb_target or trend_break:
                self.position.close()
                self.entry_price = 0
