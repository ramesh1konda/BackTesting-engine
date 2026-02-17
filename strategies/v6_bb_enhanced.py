"""
Strategy V6: Enhanced Bollinger Bounce with Trend Filter + Stop Loss
Builds on V2's success but adds:
  - 200-SMA trend filter (only buy in uptrends)
  - Wider buy zone (buy below 0.1 %B instead of 0.0)
  - Tighter sell zone (sell above 0.85 %B)
  - Stop loss to protect gains
  - RSI confirmation to avoid catching falling knives
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


class BBEnhanced(Strategy):
    bb_period = 20
    bb_std = 2.0
    sma_period = 150
    rsi_period = 14
    buy_bb = 0.05
    sell_bb = 0.85
    rsi_floor = 25
    rsi_ceiling = 75
    stop_loss_pct = 0.08

    def init(self):
        self.pct_b = self.I(BollingerPctB, self.data.Close, self.bb_period, self.bb_std)
        self.sma = self.I(SMA, self.data.Close, self.sma_period)
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)
        self.entry_price = 0

    def next(self):
        if np.isnan(self.pct_b[-1]) or np.isnan(self.sma[-1]) or np.isnan(self.rsi[-1]):
            return

        price = self.data.Close[-1]
        in_uptrend = price > self.sma[-1]

        if not self.position:
            if (self.pct_b[-1] <= self.buy_bb and
                in_uptrend and
                self.rsi[-1] > self.rsi_floor):
                self.buy()
                self.entry_price = price
        else:
            hit_stop = price < self.entry_price * (1 - self.stop_loss_pct)
            hit_target = self.pct_b[-1] >= self.sell_bb or self.rsi[-1] > self.rsi_ceiling
            trend_break = not in_uptrend

            if hit_stop or hit_target or trend_break:
                self.position.close()
                self.entry_price = 0
