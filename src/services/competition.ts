import { DexScreenerService } from './dexscreener';
import { DexScreenerPair } from '../types';

interface BuyerStats {
  address: string;
  totalBought: number;
  buyCount: number;
  avgBuySize: number;
  firstBuyTime?: number;
  lastBuyTime?: number;
}

export class CompetitionService {
  private dexScreener: DexScreenerService;
  private buyerData: Map<string, Map<string, BuyerStats>>; // tokenAddress -> buyerAddress -> stats

  constructor(dexScreener: DexScreenerService) {
    this.dexScreener = dexScreener;
    this.buyerData = new Map();
  }

  recordBuy(tokenAddress: string, buyerAddress: string, amount: number): void {
    if (!this.buyerData.has(tokenAddress)) {
      this.buyerData.set(tokenAddress, new Map());
    }

    const tokenBuyers = this.buyerData.get(tokenAddress)!;
    const existingStats = tokenBuyers.get(buyerAddress);

    if (existingStats) {
      existingStats.totalBought += amount;
      existingStats.buyCount += 1;
      existingStats.avgBuySize = existingStats.totalBought / existingStats.buyCount;
      existingStats.lastBuyTime = Date.now();
    } else {
      tokenBuyers.set(buyerAddress, {
        address: buyerAddress,
        totalBought: amount,
        buyCount: 1,
        avgBuySize: amount,
        firstBuyTime: Date.now(),
        lastBuyTime: Date.now(),
      });
    }
  }

  getTopBuyers(tokenAddress: string, limit: number = 10): BuyerStats[] {
    const tokenBuyers = this.buyerData.get(tokenAddress);

    if (!tokenBuyers) {
      return [];
    }

    return Array.from(tokenBuyers.values())
      .sort((a, b) => b.totalBought - a.totalBought)
      .slice(0, limit);
  }

  getBuyerRank(tokenAddress: string, buyerAddress: string): number {
    const topBuyers = this.getTopBuyers(tokenAddress, 1000);
    const index = topBuyers.findIndex(b => b.address === buyerAddress);
    return index >= 0 ? index + 1 : -1;
  }

  getBuyerStats(tokenAddress: string, buyerAddress: string): BuyerStats | null {
    const tokenBuyers = this.buyerData.get(tokenAddress);
    return tokenBuyers?.get(buyerAddress) || null;
  }

  formatLeaderboard(tokenAddress: string, pair: DexScreenerPair, limit: number = 10): string {
    const topBuyers = this.getTopBuyers(tokenAddress, limit);

    if (topBuyers.length === 0) {
      return '📊 *Leaderboard*\n\nNo buyers tracked yet.';
    }

    let message = `🏆 *${pair.baseToken.symbol} Top Buyers*\n\n`;

    topBuyers.forEach((buyer, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const shortAddr = this.shortenAddress(buyer.address);
      const totalUsd = this.formatUSD(buyer.totalBought);
      const avgUsd = this.formatUSD(buyer.avgBuySize);

      message += `${medal} \`${shortAddr}\`\n`;
      message += `   💰 Total: ${totalUsd} | Avg: ${avgUsd}\n`;
      message += `   📊 Buys: ${buyer.buyCount}\n\n`;
    });

    return message;
  }

  getTotalBuyers(tokenAddress: string): number {
    const tokenBuyers = this.buyerData.get(tokenAddress);
    return tokenBuyers?.size || 0;
  }

  getTotalVolume(tokenAddress: string): number {
    const tokenBuyers = this.buyerData.get(tokenAddress);
    if (!tokenBuyers) return 0;

    let total = 0;
    for (const stats of tokenBuyers.values()) {
      total += stats.totalBought;
    }
    return total;
  }

  clearTokenData(tokenAddress: string): void {
    this.buyerData.delete(tokenAddress);
  }

  clearAllData(): void {
    this.buyerData.clear();
  }

  private formatUSD(amount: number): string {
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  }

  private shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
