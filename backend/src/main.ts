import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS - localhost + beyaz liste (CORS_ALLOWED_ORIGINS virgülle ayrılmış liste)
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL,
    ...envOrigins,
  ].filter(Boolean) as string[]));

  app.enableCors({
    origin: (origin, callback) => {
      // origin yoksa (curl, Postman, sunucu-sunucu) izin ver
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('CORS: izin verilmedi - ' + origin));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // FIX #3: Uploads dizinini olustur - yoksa hata verir
  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
  const { mkdirSync, existsSync } = require('fs');
  if (!existsSync(uploadsDir)) {
    try { mkdirSync(uploadsDir, { recursive: true }); } catch {}
  }
  app.use('/uploads', express.static(uploadsDir));

  const config = new DocumentBuilder()
    .setTitle('MKÜ TTO API')
    .setDescription('Proje Yönetim Sistemi API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend çalışıyor: http://localhost:${port}/api`);

  // ⚠ Production-safety check: synchronize:true production'da risklidir
  if (process.env.NODE_ENV === 'production' && process.env.DB_SYNC !== 'false') {
    console.warn('⚠⚠⚠ TypeORM synchronize:true PRODUCTION\'DA AÇIK ⚠⚠⚠');
    console.warn('   Schema değişiklikleri otomatik DB\'ye uygulanır.');
    console.warn('   Yanlış kolon değişikliği veri kaybına neden olabilir.');
    console.warn('   Migration moduna geçmek için: DB_SYNC=false set edin.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠ ANTHROPIC_API_KEY tanımlı değil - AI özellikleri kural-tabanlı fallback kullanır.');
  }
  if (!process.env.SCOPUS_API_KEY) {
    console.warn('⚠ SCOPUS_API_KEY tanımlı değil - Scopus entegrasyonu pasif.');
  }
}
bootstrap();
