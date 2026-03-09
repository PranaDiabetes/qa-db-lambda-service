import { handler } from '../src/handler';
import * as db from '../src/db';
import { Collection, Db } from 'mongodb';

jest.mock('../src/db');

const mockGetDatabase = db.getDatabase as jest.MockedFunction<typeof db.getDatabase>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollection(overrides: Partial<Collection> = {}): jest.Mocked<Collection> {
  return {
    find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'abc123' }),
    insertMany: jest.fn().mockResolvedValue({ insertedIds: { 0: 'id1', 1: 'id2' }, insertedCount: 2 }),
    updateMany: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    aggregate: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    ...overrides,
  } as unknown as jest.Mocked<Collection>;
}

function makeDb(collection: jest.Mocked<Collection>): jest.Mocked<Db> {
  return {
    collection: jest.fn().mockReturnValue(collection),
    command: jest.fn().mockResolvedValue({ ok: 1 }),
  } as unknown as jest.Mocked<Db>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handler', () => {
  let mockCollection: jest.Mocked<Collection>;
  let mockDb: jest.Mocked<Db>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection = makeCollection();
    mockDb = makeDb(mockCollection);
    mockGetDatabase.mockResolvedValue(mockDb);
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it('returns 500 when action is missing', async () => {
    const res = await handler({} as never);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/action/i);
  });

  it('returns 500 for an unknown action', async () => {
    const res = await handler({ action: 'unknown' as never });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/unknown action/i);
  });

  it('returns 500 when collection is missing for query', async () => {
    const res = await handler({ action: 'query' });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/collection/i);
  });

  // -------------------------------------------------------------------------
  // query
  // -------------------------------------------------------------------------

  describe('query', () => {
    it('returns documents matching the filter', async () => {
      const docs = [{ _id: 'id1', name: 'Alice' }];
      mockCollection.find = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(docs) });

      const res = await handler({ action: 'query', collection: 'users', filter: { name: 'Alice' } });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.documents).toEqual(docs);
      expect(body.count).toBe(1);
    });

    it('uses an empty filter when none is provided', async () => {
      const res = await handler({ action: 'query', collection: 'users' });
      expect(res.statusCode).toBe(200);
      expect(mockCollection.find).toHaveBeenCalledWith({}, {});
    });
  });

  // -------------------------------------------------------------------------
  // insert
  // -------------------------------------------------------------------------

  describe('insert', () => {
    it('inserts a single document and returns its id', async () => {
      const res = await handler({ action: 'insert', collection: 'users', data: { name: 'Bob' } });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.insertedId).toBe('abc123');
      expect(body.insertedCount).toBe(1);
    });

    it('returns 500 when data is missing', async () => {
      const res = await handler({ action: 'insert', collection: 'users' });
      expect(res.statusCode).toBe(500);
    });

    it('returns 500 when data is an array (use insertMany instead)', async () => {
      const res = await handler({ action: 'insert', collection: 'users', data: [] as never });
      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // insertMany
  // -------------------------------------------------------------------------

  describe('insertMany', () => {
    it('inserts multiple documents and returns their ids', async () => {
      const res = await handler({
        action: 'insertMany',
        collection: 'users',
        data: [{ name: 'Bob' }, { name: 'Carol' }],
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.insertedIds).toEqual(['id1', 'id2']);
      expect(body.insertedCount).toBe(2);
    });

    it('returns 500 when data is not an array', async () => {
      const res = await handler({ action: 'insertMany', collection: 'users', data: { name: 'Bob' } as never });
      expect(res.statusCode).toBe(500);
    });

    it('returns 500 when data is an empty array', async () => {
      const res = await handler({ action: 'insertMany', collection: 'users', data: [] as never });
      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('updates matching documents', async () => {
      const res = await handler({
        action: 'update',
        collection: 'users',
        filter: { name: 'Bob' },
        update: { $set: { name: 'Robert' } },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.matchedCount).toBe(1);
      expect(body.modifiedCount).toBe(1);
    });

    it('returns 500 when update field is missing', async () => {
      const res = await handler({ action: 'update', collection: 'users', filter: {} });
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toMatch(/update/i);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes matching documents', async () => {
      const res = await handler({ action: 'delete', collection: 'users', filter: { name: 'Bob' } });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.deletedCount).toBe(1);
    });

    it('uses an empty filter when none provided (deletes all)', async () => {
      const res = await handler({ action: 'delete', collection: 'users' });
      expect(res.statusCode).toBe(200);
      expect(mockCollection.deleteMany).toHaveBeenCalledWith({});
    });
  });

  // -------------------------------------------------------------------------
  // aggregate
  // -------------------------------------------------------------------------

  describe('aggregate', () => {
    it('runs an aggregation pipeline', async () => {
      const docs = [{ _id: 'group1', total: 42 }];
      mockCollection.aggregate = jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue(docs) });

      const pipeline = [{ $group: { _id: '$category', total: { $sum: '$amount' } } }];
      const res = await handler({ action: 'aggregate', collection: 'orders', pipeline });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.documents).toEqual(docs);
      expect(body.count).toBe(1);
    });

    it('returns 500 when pipeline is missing', async () => {
      const res = await handler({ action: 'aggregate', collection: 'orders' });
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toMatch(/pipeline/i);
    });
  });

  // -------------------------------------------------------------------------
  // healthcheck
  // -------------------------------------------------------------------------

  describe('healthcheck', () => {
    it('returns ok when ping succeeds', async () => {
      const res = await handler({ action: 'healthcheck' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
    });

    it('returns 500 when ping fails', async () => {
      mockDb.command = jest.fn().mockRejectedValue(new Error('connection refused'));
      const res = await handler({ action: 'healthcheck' });
      expect(res.statusCode).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // API Gateway proxy format
  // -------------------------------------------------------------------------

  describe('API Gateway proxy event', () => {
    it('parses the body JSON and executes the action', async () => {
      const apiEvent = {
        body: JSON.stringify({ action: 'healthcheck' }),
      };

      const res = await handler(apiEvent as never);
      expect(res.statusCode).toBe(200);
    });
  });
});
