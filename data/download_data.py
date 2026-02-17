"""Download S&P 500 historical data using yfinance."""
import yfinance as yf
import os

def download_sp500(period="max", save_path=None):
    """Download S&P 500 (SPY ETF) daily OHLCV data."""
    if save_path is None:
        save_path = os.path.join(os.path.dirname(__file__), "spy_daily.csv")

    print("Downloading SPY daily data...")
    spy = yf.download("SPY", period=period, auto_adjust=True)
    spy.to_csv(save_path)
    print(f"Saved {len(spy)} rows to {save_path}")
    return spy

if __name__ == "__main__":
    download_sp500()
