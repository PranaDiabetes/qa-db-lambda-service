import { MongoClient, Db } from 'mongodb';
import { getMongoClient, getDatabase, closeConnection } from '../src/db';

jest.mock('mongodb');

const MockedMongoClient = MongoClient as jest.MockedClass<typeof MongoClient>;

describe('db.ts', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(async () => {
    await closeConnection();
    process.env = ORIGINAL_ENV;
  });

  describe('getMongoClient', () => {
    it('throws when MONGODB_URI is not set', async () => {
      delete process.env.MONGODB_URI;
      await expect(getMongoClient()).rejects.toThrow('MONGODB_URI environment variable is not set');
    });

    it('creates and returns a connected client', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017';

      const mockConnect = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      MockedMongoClient.mockImplementation(
        () => ({ connect: mockConnect, close: mockClose } as unknown as MongoClient),
      );

      const client = await getMongoClient();
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(client).toBeDefined();
    });

    it('reuses the existing client on subsequent calls', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017';

      const mockConnect = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      MockedMongoClient.mockImplementation(
        () => ({ connect: mockConnect, close: mockClose } as unknown as MongoClient),
      );

      const first = await getMongoClient();
      const second = await getMongoClient();

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });
  });

  describe('getDatabase', () => {
    it('throws when DB_NAME is not set', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017';
      delete process.env.DB_NAME;

      const mockConnect = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      MockedMongoClient.mockImplementation(
        () => ({ connect: mockConnect, close: mockClose } as unknown as MongoClient),
      );

      await expect(getDatabase()).rejects.toThrow('DB_NAME environment variable is not set');
    });

    it('returns the correct database', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017';
      process.env.DB_NAME = 'testdb';

      const mockDb = {} as Db;
      const mockDbFn = jest.fn().mockReturnValue(mockDb);
      const mockConnect = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      MockedMongoClient.mockImplementation(
        () => ({ connect: mockConnect, close: mockClose, db: mockDbFn } as unknown as MongoClient),
      );

      const db = await getDatabase();
      expect(mockDbFn).toHaveBeenCalledWith('testdb');
      expect(db).toBe(mockDb);
    });
  });

  describe('closeConnection', () => {
    it('closes the client and resets it', async () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017';

      const mockClose = jest.fn().mockResolvedValue(undefined);
      const mockConnect = jest.fn().mockResolvedValue(undefined);
      MockedMongoClient.mockImplementation(
        () => ({ connect: mockConnect, close: mockClose } as unknown as MongoClient),
      );

      await getMongoClient();
      await closeConnection();

      expect(mockClose).toHaveBeenCalledTimes(1);

      // A new client should be created after close
      await getMongoClient();
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when no client is connected', async () => {
      await expect(closeConnection()).resolves.not.toThrow();
    });
  });
});
