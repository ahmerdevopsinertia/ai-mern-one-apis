import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';

async function bootstrap() {

  dotenv.config(); // Load .env file
  
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api'); // 👈 Adds /api to all routes

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('AI Chat Bot API')
    .setDescription('The AI Chat Bot API description')
    .setVersion('1.0')
    .addTag('AIChatBot')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  app.enableCors({
    origin: 'http://localhost:3000', // or your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
