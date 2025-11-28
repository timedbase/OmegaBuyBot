import axios, { AxiosInstance } from 'axios';
import { DexScreenerPair } from '../types';
import { config } from '../config';

export class DexScreenerService {
  private client: AxiosInstance;
  private cache: Map<string, { data: DexScreenerPair[]; timestamp: number }>;
  private readonly CACHE_TTL = 5000; // 5 seconds cache

  constructor() {
    this.client = axios.create({
      baseURL: config.dexScreenerApiUrl,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
      },
    });
    this.cache = new Map();
  }

  async getTokenPairs(tokenAddress: string): Promise<DexScreenerPair[]> {
    const cacheKey = `pairs_${tokenAddress}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await this.client.get(`/dex/tokens/${tokenAddress}`);
      const pairs = response.data.pairs || [];

      // Filter for Monad chain only
      const monadPairs = pairs.filter(
        (pair: DexScreenerPair) => pair.chainId === config.monadChainId
      );

      this.cache.set(cacheKey, { data: monadPairs, timestamp: Date.now() });
      return monadPairs;
    } catch (error) {
      console.error(`Error fetching token pairs for ${tokenAddress}:`, error);
      return [];
    }
  }

  async getPairByAddress(pairAddress: string): Promise<DexScreenerPair | null> {
    const cacheKey = `pair_${pairAddress}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data[0] || null;
    }

    try {
      const response = await this.client.get(`/dex/pairs/${config.monadChainId}/${pairAddress}`);
      const pair = response.data.pair;

      if (pair) {
        this.cache.set(cacheKey, { data: [pair], timestamp: Date.now() });
        return pair;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching pair ${pairAddress}:`, error);
      return null;
    }
  }

  async searchTokens(query: string): Promise<DexScreenerPair[]> {
    try {
      const response = await this.client.get(`/dex/search?q=${encodeURIComponent(query)}`);
      const pairs = response.data.pairs || [];

      return pairs.filter(
        (pair: DexScreenerPair) => pair.chainId === config.monadChainId
      );
    } catch (error) {
      console.error(`Error searching for tokens with query "${query}":`, error);
      return [];
    }
  }

  async getLatestBuys(tokenAddress: string): Promise<DexScreenerPair | null> {
    const pairs = await this.getTokenPairs(tokenAddress);

    if (pairs.length === 0) {
      return null;
    }

    // Return pair with highest liquidity
    return pairs.sort((a, b) => {
      const liquidityA = a.liquidity?.usd || 0;
      const liquidityB = b.liquidity?.usd || 0;
      return liquidityB - liquidityA;
    })[0] || null;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
