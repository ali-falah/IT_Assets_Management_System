import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    this.client = createClient({
      socket: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            return false; // Stop hammering when down
          }
          return Math.min(retries * 500, 3000);
        },
        connectTimeout: 2000,
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.warn(`Redis connection error: ${err.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`Could not connect to Redis initially: ${err.message}. Running in degraded mode.`);
    }
  }

  async onModuleDestroy() {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect();
      }
    } catch (e) {
      // ignore
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client.isOpen) return;
    try {
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      this.logger.warn(`Redis set error for ${key}: ${err.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client.isOpen) return null;
    try {
      return await this.client.get(key);
    } catch (err: any) {
      this.logger.warn(`Redis get error for ${key}: ${err.message}`);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client.isOpen) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del error for ${key}: ${err.message}`);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client.isOpen) return [];
    try {
      return await this.client.keys(pattern);
    } catch (err: any) {
      this.logger.warn(`Redis keys error for ${pattern}: ${err.message}`);
      return [];
    }
  }
}
