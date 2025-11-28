import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

export const config: BotConfig = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  dexScreenerApiUrl: process.env.DEXSCREENER_API_URL || 'https://api.dexscreener.com/latest',
  monadChainId: process.env.MONAD_CHAIN_ID || 'monad',
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000', 10),
  minBuyAmountUsd: parseFloat(process.env.MIN_BUY_AMOUNT_USD || '100'),
};

export function validateConfig(): void {
  if (!config.telegramToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
}
