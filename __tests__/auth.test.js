/**
 * Auth route integration tests.
 * Uses supertest to call the app without starting a real server.
 * MongoDB calls are mocked so no real database is needed.
 */
process.env.JWT_SECRET = 'test-secret-for-jest';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/budget-app-test';

const request = require('supertest');

// Mock mongoose so tests don't require a real MongoDB instance
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: { on: jest.fn() },
    Promise: global.Promise,
  };
});

// Mock the UserModel used inside auth strategies and routes
jest.mock('../models/user', () => {
  const bcrypt = jest.requireActual('bcrypt');
  const mockUser = {
    _id: 'user-id-123',
    email: 'test@example.com',
    name: 'Test User',
    password: '',
    isValidPassword: jest.fn(),
  };

  const UserModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  return UserModel;
});

const app = require('../app');
const UserModel = require('../models/user');

describe('POST /signup', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 422 when email is invalid', async () => {
    const res = await request(app).post('/signup').send({ email: 'bad', password: 'password123', name: 'Alice' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  test('returns 422 when password is too short', async () => {
    const res = await request(app).post('/signup').send({ email: 'alice@example.com', password: 'short', name: 'Alice' });
    expect(res.status).toBe(422);
  });

  test('returns 422 when name is missing', async () => {
    const res = await request(app).post('/signup').send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(422);
  });

  test('returns 201 on successful signup', async () => {
    UserModel.create.mockResolvedValue({
      _id: 'new-id',
      email: 'alice@example.com',
      name: 'Alice',
    });

    const res = await request(app)
      .post('/signup')
      .send({ email: 'alice@example.com', password: 'password123', name: 'Alice' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Signup successful');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  test('returns 400 when email already registered', async () => {
    const err = new Error('duplicate');
    err.code = 11000;
    UserModel.create.mockRejectedValue(err);

    const res = await request(app)
      .post('/signup')
      .send({ email: 'existing@example.com', password: 'password123', name: 'Bob' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

describe('POST /login', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns 422 when fields are missing', async () => {
    const res = await request(app).post('/login').send({});
    expect(res.status).toBe(422);
  });

  test('returns 401 when user not found', async () => {
    UserModel.findOne.mockResolvedValue(null);
    const res = await request(app).post('/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('returns 401 when password is wrong', async () => {
    UserModel.findOne.mockResolvedValue({
      _id: 'uid',
      email: 'user@example.com',
      name: 'User',
      isValidPassword: jest.fn().mockResolvedValue(false),
    });
    const res = await request(app).post('/login').send({ email: 'user@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('returns token on successful login', async () => {
    UserModel.findOne.mockResolvedValue({
      _id: 'uid',
      email: 'user@example.com',
      name: 'User',
      isValidPassword: jest.fn().mockResolvedValue(true),
    });
    const res = await request(app).post('/login').send({ email: 'user@example.com', password: 'correctpass' });
    expect(res.status).toBe(200);
    expect(res.body.user.token).toBeDefined();
    expect(res.body.user.email).toBe('user@example.com');
  });
});
