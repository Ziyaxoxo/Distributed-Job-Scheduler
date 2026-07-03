import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { isDatabaseAvailable } from './helpers';

const app = createApp();
let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
});

describe('Auth API', () => {
  it('rejects protected routes without token', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('registers and logs in a user', async () => {
    if (!dbAvailable) return;
    const email = `user-${Date.now()}@test.local`;
    const password = 'password12345';

    const register = await request(app)
      .post('/api/auth/register')
      .send({ email, password });
    expect(register.status).toBe(201);
    expect(register.body.token).toBeDefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });

  it('rejects invalid login', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
