import { config, validateConfig } from './config';
import { TelegramService } from './services/telegram';
import { DexScreenerService } from './services/dexscreener';
import { MonitorService } from './services/monitor';
import { logger } from './utils/logger';

async function main() {
  try {
    // Validate configuration
    validateConfig();
    logger.info('✅ Configuration validated');

    // Initialize services
    const dexScreener = new DexScreenerService();
    logger.info('✅ DexScreener service initialized');

    const telegram = new TelegramService();
    logger.info('✅ Telegram service initialized');

    const monitor = new MonitorService(dexScreener, telegram);
    logger.info('✅ Monitor service initialized');

    // Start services
    await telegram.start();
    logger.info('✅ Telegram bot started');

    await monitor.start();
    logger.info('✅ Buy monitor started');

    logger.info('🚀 OmegaBuyBot is now running!');
    logger.info(`📊 Monitoring Monad blockchain (${config.monadChainId})`);
    logger.info(`🔔 Minimum buy notification: $${config.minBuyAmountUsd}`);
    logger.info(`⏱️  Polling interval: ${config.pollingInterval}ms`);

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('\n🛑 Shutting down OmegaBuyBot...');
      await monitor.stop();
      await telegram.stop();
      logger.info('👋 OmegaBuyBot stopped');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Start the bot
main();
