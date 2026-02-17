"""
Strategy V2: Bollinger Band Bounce
Buy when price touches lower Bollinger Band (cycle low).
Sell when price touches upper Bollinger Band (cycle high).
Uses %B indicator to measure position within bands.
"""
from backtesting import Strategy
import numpy as np


def SMA(series, period):
    out = np.full_like(series, np.nan)
    for i in range(period - 1, len(series)):
        out[i] = np.mean(series[i - period + 1:i + 1])
    return out


def BollingerPctB(close, period=20, num_std=2.0):
    """Bollinger %B: 0 = lower band, 1 = upper band."""
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


class BollingerBounce(Strategy):
    bb_period = 20
    bb_std = 2.0
    buy_threshold = 0.0    # Buy at or below lower band
    sell_threshold = 1.0   # Sell at or above upper band

    def init(self):
        self.pct_b = self.I(BollingerPctB, self.data.Close, self.bb_period, self.bb_std)

    def next(self):
        if not self.position:
            if self.pct_b[-1] <= self.buy_threshold:
                self.buy()
        else:
            if self.pct_b[-1] >= self.sell_threshold:
                self.position.close()
