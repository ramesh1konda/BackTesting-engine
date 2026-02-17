"""
Strategy V1: RSI Mean Reversion
Buy when RSI drops below oversold threshold (cycle low).
Sell when RSI rises above overbought threshold (cycle high).
"""
from backtesting import Strategy
from backtesting.lib import crossover
import numpy as np


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


class RSIMeanReversion(Strategy):
    rsi_period = 14
    oversold = 30
    overbought = 70

    def init(self):
        self.rsi = self.I(RSI, self.data.Close, self.rsi_period)

    def next(self):
        if not self.position:
            if self.rsi[-1] < self.oversold:
                self.buy()
        else:
            if self.rsi[-1] > self.overbought:
                self.position.close()
