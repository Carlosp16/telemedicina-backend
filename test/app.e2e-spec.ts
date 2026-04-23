import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';

/**
 * Smoke test mínimo de arranque + /health.
 *
 * Requiere MongoDB accesible en la cadena MONGO_URI (por defecto localhost).
 */
describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/users/register con código inválido → 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users/register')
      .send({
        accessCode: 'INVALIDO9',
        email: 'noexiste@example.com',
        password: 'test_123',
      });
    expect([400, 404]).toContain(res.status);
  });
});
