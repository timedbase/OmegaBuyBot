export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd?: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd?: number;
    base: number;
    quote: number;
  };
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

export interface Transaction {
  hash: string;
  timestamp: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUsd?: number;
  tokenSymbol: string;
  tokenAddress: string;
  type: 'buy' | 'sell';
  priceUsd?: string;
}

export interface TrackedToken {
  address: string;
  symbol: string;
  name: string;
  chatId: number;
  minBuyAmount?: number;
  notifyAll?: boolean;
}

export interface BotConfig {
  telegramToken: string;
  dexScreenerApiUrl: string;
  monadChainId: string;
  pollingInterval: number;
  minBuyAmountUsd: number;
}

export interface NotificationData {
  token: TrackedToken;
  transaction: Transaction;
  pair: DexScreenerPair;
  buyerPosition?: {
    totalBought: number;
    percentOfSupply: number;
  };
}
