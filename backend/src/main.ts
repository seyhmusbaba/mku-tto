import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — localhost + Railway frontend URL'leri
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Railway frontend URL'ini FRONTEND_URL env değişkeni ile ekle
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // origin yoksa (curl, Postman, sunucu-sunucu) izin ver
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.endsWith('.railway.app')) {
        return callback(null, true);
      }
      callback(new Error('CORS: izin verilmedi'));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

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
}
bootstrap();
