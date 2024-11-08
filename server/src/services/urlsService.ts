import { generateUniqueToken } from '../config/zookeeper';
import { get, set, extendTTL, RedisExpirationMode } from '../config/redis';
import { IUrl } from '../models/Url';
import { isValidUrl } from '../utils';
import { create, findAll, findOne } from '../repositories/urlsRepository';

const ONE_MINUTE_IN_SECONDS = 60;

// Get all shortened URLs
export const getAllUrls = async (): Promise<IUrl[]> => await findAll();

// Get a specific shortened URL by its key
export const getUrlByShortenUrlKey = async (
  shortenUrlKey: string
): Promise<string | null> => {
  // Try to get the original URL from Redis cache
  const cachedOriginalUrl = await get(shortenUrlKey);
  if (cachedOriginalUrl) {
    // Extend TTL
    await extendTTL(shortenUrlKey, ONE_MINUTE_IN_SECONDS);

    return cachedOriginalUrl; // Return the cached original URL
  }

  // If not in cache, retrieve from database
  const savedUrl = await findOne({ shortenUrlKey });
  if (savedUrl) {
    // Cache the original URL created by its shorten URL key
    await set(
      savedUrl.shortenUrlKey,
      savedUrl.originalUrl,
      RedisExpirationMode.EX,
      ONE_MINUTE_IN_SECONDS
    );

    return savedUrl.originalUrl; // Return the saved original URL
  }

  return null; // Return null if nothing found
};

// Create a new shortened URL
export const createShortenedUrl = async (
  originalUrl: string
): Promise<string | null> => {
  // Check if URL is valid
  if (!isValidUrl(originalUrl)) {
    return null;
  }

  // Retrieve from database
  const savedUrl = await findOne({ originalUrl });
  if (savedUrl) {
    return savedUrl.shortenUrlKey; // Return the saved shortened URL key
  }

  // If not in database, generate a new shortened URL key and save it
  const shortenUrlKey = await generateUniqueToken();
  if (shortenUrlKey) {
    const newUrl = await create({
      originalUrl,
      shortenUrlKey,
    });

    // Cache the original URL created by its shorten URL key
    await set(
      newUrl.shortenUrlKey,
      newUrl.originalUrl,
      RedisExpirationMode.EX,
      ONE_MINUTE_IN_SECONDS
    );

    return newUrl.shortenUrlKey; // Return shortened URL key
  }

  return null; // Return null if token generation failed
};
