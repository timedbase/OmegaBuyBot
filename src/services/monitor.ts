import { DexScreenerService } from './dexscreener';
import { TelegramService } from './telegram';
import { TrackedToken, NotificationData, DexScreenerPair } from '../types';
import { config } from '../config';

interface TokenState {
  lastBuyCount: number;
  lastSellCount: number;
  lastVolume: number;
  lastChecked: number;
}

export class MonitorService {
  private dexScreener: DexScreenerService;
  private telegram: TelegramService;
  private tokenStates: Map<string, TokenState>;
  private isRunning: boolean;
  private intervalId?: NodeJS.Timeout;

  constructor(dexScreener: DexScreenerService, telegram: TelegramService) {
    this.dexScreener = dexScreener;
    this.telegram = telegram;
    this.tokenStates = new Map();
    this.isRunning = false;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Monitor is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔍 Starting buy monitor...');

    // Initial check
    await this.checkAllTokens();

    // Set up interval for continuous monitoring
    this.intervalId = setInterval(async () => {
      await this.checkAllTokens();
    }, config.pollingInterval);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping buy monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async checkAllTokens(): Promise<void> {
    const trackedTokens = this.telegram.getTrackedTokens();

    if (trackedTokens.size === 0) {
      return;
    }

    const uniqueTokens = new Map<string, TrackedToken[]>();

    // Group chats by token address
    for (const [chatId, tokens] of trackedTokens) {
      for (const token of tokens) {
        const address = token.address.toLowerCase();
        if (!uniqueTokens.has(address)) {
          uniqueTokens.set(address, []);
        }
        uniqueTokens.get(address)?.push(token);
      }
    }

    // Check each unique token
    for (const [address, tokens] of uniqueTokens) {
      await this.checkToken(address, tokens);
    }
  }

  private async checkToken(address: string, tokens: TrackedToken[]): Promise<void> {
    try {
      const pair = await this.dexScreener.getLatestBuys(address);

      if (!pair) {
        return;
      }

      // Update token info if needed
      for (const token of tokens) {
        if (token.symbol === 'Unknown') {
          token.symbol = pair.baseToken.symbol;
          token.name = pair.baseToken.name;
        }
      }

      const state = this.tokenStates.get(address);
      const currentBuyCount = pair.txns.m5.buys;
      const currentVolume = pair.volume.m5;

      if (!state) {
        // First time checking this token
        this.tokenStates.set(address, {
          lastBuyCount: currentBuyCount,
          lastSellCount: pair.txns.m5.sells,
          lastVolume: currentVolume,
          lastChecked: Date.now(),
        });
        return;
      }

      // Check if there are new buys
      const newBuys = currentBuyCount - state.lastBuyCount;
      const volumeIncrease = currentVolume - state.lastVolume;

      if (newBuys > 0 && volumeIncrease > 0) {
        // Estimate average buy amount
        const avgBuyAmount = volumeIncrease / newBuys;

        // Check if buy amount meets minimum threshold for each token
        for (const token of tokens) {
          const minAmount = token.minBuyAmount || config.minBuyAmountUsd;

          if (avgBuyAmount >= minAmount) {
            await this.sendNotification(token, pair, avgBuyAmount);
          }
        }
      }

      // Update state
      this.tokenStates.set(address, {
        lastBuyCount: currentBuyCount,
        lastSellCount: pair.txns.m5.sells,
        lastVolume: currentVolume,
        lastChecked: Date.now(),
      });

    } catch (error) {
      console.error(`Error checking token ${address}:`, error);
    }
  }

  private async sendNotification(
    token: TrackedToken,
    pair: DexScreenerPair,
    buyAmount: number
  ): Promise<void> {
    const notificationData: NotificationData = {
      token,
      transaction: {
        hash: 'N/A',
        timestamp: Date.now(),
        fromAddress: 'Unknown',
        toAddress: pair.pairAddress,
        amount: buyAmount.toString(),
        amountUsd: buyAmount,
        tokenSymbol: pair.baseToken.symbol,
        tokenAddress: pair.baseToken.address,
        type: 'buy',
        priceUsd: pair.priceUsd,
      },
      pair,
    };

    await this.telegram.sendBuyNotification(notificationData);
  }

  getTokenStates(): Map<string, TokenState> {
    return this.tokenStates;
  }
}
