import { Bot, Context, InlineKeyboard } from 'grammy';
import { config } from '../config';
import { NotificationData, TrackedToken } from '../types';
import { CompetitionService } from './competition';

export class TelegramService {
  private bot: Bot;
  private trackedTokens: Map<number, TrackedToken[]>; // chatId -> tokens
  private competition?: CompetitionService;

  constructor() {
    this.bot = new Bot(config.telegramToken);
    this.trackedTokens = new Map();
    this.setupCommands();
  }

  setCompetitionService(competition: CompetitionService): void {
    this.competition = competition;
  }

  private setupCommands(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 *Welcome to OmegaBuyBot!*\n\n' +
        'Track buy notifications for tokens on Monad blockchain.\n\n' +
        '*Commands:*\n' +
        '/track <token_address> - Start tracking a token\n' +
        '/untrack <token_address> - Stop tracking a token\n' +
        '/list - Show tracked tokens\n' +
        '/setmin <amount> - Set minimum buy amount in USD\n' +
        '/help - Show this help message',
        { parse_mode: 'Markdown' }
      );
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '*OmegaBuyBot Commands*\n\n' +
        '📊 *Tracking*\n' +
        '/track <token_address> - Start tracking token buys\n' +
        '/untrack <token_address> - Stop tracking a token\n' +
        '/list - Show all tracked tokens\n\n' +
        '⚙️ *Settings*\n' +
        '/setmin <amount> - Set minimum buy notification (USD)\n\n' +
        '💡 *Tips*\n' +
        '• Get instant notifications for large buys\n' +
        '• View detailed buyer information\n' +
        '• Competition tracking for top buyers\n' +
        '• Media support with charts and images',
        { parse_mode: 'Markdown' }
      );
    });

    // Track token command
    this.bot.command('track', async (ctx) => {
      const args = ctx.match;
      if (!args) {
        await ctx.reply('❌ Please provide a token address.\nUsage: /track <token_address>');
        return;
      }

      const tokenAddress = args.toString().trim();
      const chatId = ctx.chat?.id;

      if (!chatId) return;

      const chatTokens = this.trackedTokens.get(chatId) || [];

      if (chatTokens.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase())) {
        await ctx.reply('⚠️ This token is already being tracked.');
        return;
      }

      // Add to tracking (will be validated later with DexScreener)
      const newToken: TrackedToken = {
        address: tokenAddress,
        symbol: 'Unknown',
        name: 'Unknown',
        chatId,
        minBuyAmount: config.minBuyAmountUsd,
      };

      chatTokens.push(newToken);
      this.trackedTokens.set(chatId, chatTokens);

      await ctx.reply(
        `✅ Now tracking: \`${tokenAddress}\`\n\n` +
        `You'll receive notifications for buys over $${config.minBuyAmountUsd}`,
        { parse_mode: 'Markdown' }
      );
    });

    // Untrack token command
    this.bot.command('untrack', async (ctx) => {
      const args = ctx.match;
      if (!args) {
        await ctx.reply('❌ Please provide a token address.\nUsage: /untrack <token_address>');
        return;
      }

      const tokenAddress = args.toString().trim();
      const chatId = ctx.chat?.id;

      if (!chatId) return;

      const chatTokens = this.trackedTokens.get(chatId) || [];
      const filtered = chatTokens.filter(
        t => t.address.toLowerCase() !== tokenAddress.toLowerCase()
      );

      if (filtered.length === chatTokens.length) {
        await ctx.reply('⚠️ This token is not being tracked.');
        return;
      }

      this.trackedTokens.set(chatId, filtered);
      await ctx.reply(`✅ Stopped tracking: \`${tokenAddress}\``, { parse_mode: 'Markdown' });
    });

    // List tracked tokens
    this.bot.command('list', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const chatTokens = this.trackedTokens.get(chatId) || [];

      if (chatTokens.length === 0) {
        await ctx.reply('📭 No tokens are currently being tracked.\n\nUse /track <token_address> to start tracking.');
        return;
      }

      const list = chatTokens.map((token, idx) =>
        `${idx + 1}. ${token.symbol} - \`${token.address}\``
      ).join('\n');

      await ctx.reply(
        `📊 *Tracked Tokens (${chatTokens.length})*\n\n${list}`,
        { parse_mode: 'Markdown' }
      );
    });

    // Set minimum buy amount
    this.bot.command('setmin', async (ctx) => {
      const args = ctx.match;
      if (!args) {
        await ctx.reply('❌ Please provide an amount.\nUsage: /setmin <amount>');
        return;
      }

      const amount = parseFloat(args.toString().trim());
      if (isNaN(amount) || amount < 0) {
        await ctx.reply('❌ Please provide a valid positive number.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const chatTokens = this.trackedTokens.get(chatId) || [];
      chatTokens.forEach(token => {
        token.minBuyAmount = amount;
      });

      await ctx.reply(`✅ Minimum buy notification set to $${amount.toFixed(2)}`);
    });
  }

  async sendBuyNotification(data: NotificationData): Promise<void> {
    const { token, transaction, pair } = data;

    const priceChange = pair.priceChange.h24;
    const priceEmoji = priceChange >= 0 ? '🟢' : '🔴';
    const volumeH24 = pair.volume.h24;
    const liquidity = pair.liquidity?.usd || 0;
    const marketCap = pair.marketCap || 0;

    const message =
      `🔔 *New Buy Alert!*\n\n` +
      `💎 *${pair.baseToken.symbol}* / ${pair.quoteToken.symbol}\n` +
      `💰 *Buy Amount:* $${transaction.amountUsd?.toFixed(2) || 'N/A'}\n` +
      `💵 *Price:* $${pair.priceUsd || 'N/A'}\n` +
      `${priceEmoji} *24h Change:* ${priceChange.toFixed(2)}%\n\n` +
      `📊 *Market Info:*\n` +
      `• Volume (24h): $${this.formatNumber(volumeH24)}\n` +
      `• Liquidity: $${this.formatNumber(liquidity)}\n` +
      `• Market Cap: $${this.formatNumber(marketCap)}\n\n` +
      `👤 *Buyer:* \`${this.shortenAddress(transaction.fromAddress)}\`\n` +
      `📝 *Tx:* \`${this.shortenAddress(transaction.hash)}\`\n\n` +
      `🔗 [View on DexScreener](${pair.url})`;

    const keyboard = new InlineKeyboard()
      .url('📊 DexScreener', pair.url);

    try {
      if (pair.info?.imageUrl) {
        await this.bot.api.sendPhoto(token.chatId, pair.info.imageUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } else {
        await this.bot.api.sendMessage(token.chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
          disable_web_page_preview: false,
        });
      }
    } catch (error) {
      console.error(`Error sending notification to chat ${token.chatId}:`, error);
    }
  }

  getTrackedTokens(): Map<number, TrackedToken[]> {
    return this.trackedTokens;
  }

  async start(): Promise<void> {
    console.log('🤖 Starting Telegram bot...');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Telegram bot...');
    await this.bot.stop();
  }

  private formatNumber(num: number): string {
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  }

  private shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
