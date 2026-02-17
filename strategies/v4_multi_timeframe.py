"""
Strategy V4: Multi-Timeframe Mean Reversion
Uses short-term RSI (5-day) for entry timing and medium-term RSI (14-day) for confirmation.
Bollinger Bands for additional cycle position.
Buy when both RSIs are oversold AND price near lower BB.
Sell when short RSI overbought OR price at upper BB.
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


class MultiTimeframeMR(Strategy):
    rsi_short = 5
    rsi_long = 14
    bb_period = 20
    bb_std = 2.0
    rsi_short_oversold = 20
    rsi_long_oversold = 40
    rsi_short_overbought = 80
    bb_sell_threshold = 0.95

    def init(self):
        self.rsi_s = self.I(RSI, self.data.Close, self.rsi_short)
        self.rsi_l = self.I(RSI, self.data.Close, self.rsi_long)
        self.pct_b = self.I(BollingerPctB, self.data.Close, self.bb_period, self.bb_std)

    def next(self):
        if np.isnan(self.rsi_s[-1]) or np.isnan(self.rsi_l[-1]) or np.isnan(self.pct_b[-1]):
            return

        if not self.position:
            # Buy when short RSI very oversold, long RSI below midpoint, and price near lower band
            if (self.rsi_s[-1] < self.rsi_short_oversold and
                self.rsi_l[-1] < self.rsi_long_oversold and
                self.pct_b[-1] < 0.2):
                self.buy()
        else:
            # Sell when short RSI overbought OR price at upper band
            if (self.rsi_s[-1] > self.rsi_short_overbought or
                self.pct_b[-1] > self.bb_sell_threshold):
                self.position.close()
