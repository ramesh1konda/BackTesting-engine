"""
Strategy V5: Composite Cycle Score
Combines multiple oscillators into a single "cycle score":
  - RSI (14)
  - Bollinger %B (20)
  - Stochastic %K (14)
  - Rate of Change (10)
  - Williams %R (14)

Each is normalized to 0-100. The composite average determines cycle position.
Buy when composite is deeply oversold. Sell when composite is overbought.
Includes a 200-SMA trend filter for safety.
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
    return pct_b * 100  # Scale to 0-100


def StochasticK(high, low, close, period=14):
    """Stochastic %K (0-100)."""
    out = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        hh = np.max(high[i - period + 1:i + 1])
        ll = np.min(low[i - period + 1:i + 1])
        if hh - ll > 0:
            out[i] = 100 * (close[i] - ll) / (hh - ll)
        else:
            out[i] = 50.0
    return out


def WilliamsR(high, low, close, period=14):
    """Williams %R, inverted to 0-100 scale (0=oversold, 100=overbought)."""
    out = np.full_like(close, np.nan)
    for i in range(period - 1, len(close)):
        hh = np.max(high[i - period + 1:i + 1])
        ll = np.min(low[i - period + 1:i + 1])
        if hh - ll > 0:
            wr = -100 * (hh - close[i]) / (hh - ll)
            out[i] = wr + 100  # Invert: 0=oversold, 100=overbought
        else:
            out[i] = 50.0
    return out


def ROC_norm(close, period=10):
    """Rate of change, normalized to roughly 0-100 scale using percentile rank."""
    roc = np.full_like(close, np.nan)
    for i in range(period, len(close)):
        if close[i - period] != 0:
            roc[i] = (close[i] / close[i - period] - 1) * 100
    # Rolling percentile rank over 252 trading days (1 year)
    lookback = 252
    out = np.full_like(close, np.nan)
    for i in range(lookback, len(close)):
        window = roc[i - lookback + 1:i + 1]
        valid = window[~np.isnan(window)]
        if len(valid) > 10:
            out[i] = 100 * np.sum(valid < roc[i]) / len(valid)
    return out


def CompositeScore(close, high, low):
    """Compute composite cycle score (0-100)."""
    rsi = RSI(close, 14)
    bb_pctb = BollingerPctB(close, 20, 2.0)
    stoch = StochasticK(high, low, close, 14)
    williams = WilliamsR(high, low, close, 14)
    roc_n = ROC_norm(close, 10)

    # Average available indicators
    composite = np.full_like(close, np.nan)
    for i in range(len(close)):
        vals = []
        for ind in [rsi[i], bb_pctb[i], stoch[i], williams[i], roc_n[i]]:
            if not np.isnan(ind):
                vals.append(ind)
        if len(vals) >= 3:  # Need at least 3 indicators
            composite[i] = np.mean(vals)
    return composite


class CompositeCycleStrategy(Strategy):
    buy_threshold = 20
    sell_threshold = 75
    use_trend_filter = True
    sma_period = 200

    def init(self):
        self.score = self.I(CompositeScore, self.data.Close, self.data.High, self.data.Low)
        if self.use_trend_filter:
            self.sma200 = self.I(SMA, self.data.Close, self.sma_period)

    def next(self):
        if np.isnan(self.score[-1]):
            return

        in_uptrend = True
        if self.use_trend_filter and not np.isnan(self.sma200[-1]):
            in_uptrend = self.data.Close[-1] > self.sma200[-1]

        if not self.position:
            if self.score[-1] < self.buy_threshold and in_uptrend:
                self.buy()
        else:
            if self.score[-1] > self.sell_threshold or (self.use_trend_filter and not in_uptrend):
                self.position.close()
