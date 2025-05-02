import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AIService } from '../ai/ai.service';
import { OllamaService } from '../ollama/ollama.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(), // Add this line
    HttpModule
  ],
  controllers: [ChatController],
  providers: [ChatService, OllamaService, AIService]
})
export class ChatModule { }
