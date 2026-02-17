"""
Strategy V3: Moving Average Trend + RSI Cycle Timing
Only buy dips (RSI oversold) when above the 200-day SMA (uptrend).
Sell when RSI is overbought OR price drops below 200-day SMA.
This combines trend-following with cycle timing.
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


class MARSICombo(Strategy):
    sma_period = 200
    rsi_period = 14
    oversold = 30
    overbought = 70

    def init(self):
        self.sma200 = self.I(SMA, self.data.Close, self.sma_period)
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)

    def next(self):
        price = self.data.Close[-1]
        in_uptrend = price > self.sma200[-1] if not np.isnan(self.sma200[-1]) else False

        if not self.position:
            # Buy only in uptrend when RSI signals oversold
            if in_uptrend and self.rsi[-1] < self.oversold:
                self.buy()
        else:
            # Sell on overbought OR trend break
            if self.rsi[-1] > self.overbought or not in_uptrend:
                self.position.close()
