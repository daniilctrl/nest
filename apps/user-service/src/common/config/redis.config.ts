import { createKeyv } from '@keyv/redis';
import { ConfigService } from '@nestjs/config';

const CACHE_TTL_MS = 30 * 1000;
const DEFAULT_REDIS_URL = 'redis://localhost:6379';
const BULL_DEFAULT_DB = 0;
const CACHE_DEFAULT_DB = 1;

const withRedisDb = (redisUrl: string, db: number): string => {
  const parsed = new URL(redisUrl);
  parsed.pathname = `/${db}`;
  return parsed.toString();
};

const getRedisDbFromUrl = (redisUrl: URL): number => {
  const dbPart = redisUrl.pathname.replace('/', '');
  if (!dbPart) {
    return 0;
  }
  const parsedDb = Number(dbPart);
  return Number.isNaN(parsedDb) ? 0 : parsedDb;
};

export const getCacheModuleOptions = (configService: ConfigService) => {
  const baseRedisUrl =
    configService.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL;
  const cacheRedisUrl =
    configService.get<string>('REDIS_CACHE_URL') ??
    withRedisDb(baseRedisUrl, CACHE_DEFAULT_DB);

  return {
    ttl: CACHE_TTL_MS,
    stores: [createKeyv(cacheRedisUrl)],
  };
};

export const getBullModuleOptions = (configService: ConfigService) => {
  const baseRedisUrl =
    configService.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL;
  const bullRedisUrl =
    configService.get<string>('REDIS_BULL_URL') ??
    withRedisDb(baseRedisUrl, BULL_DEFAULT_DB);
  const parsedRedisUrl = new URL(bullRedisUrl);

  return {
    connection: {
      host: parsedRedisUrl.hostname,
      port: Number(parsedRedisUrl.port || 6379),
      password: parsedRedisUrl.password || undefined,
      db: getRedisDbFromUrl(parsedRedisUrl),
    },
  };
};
