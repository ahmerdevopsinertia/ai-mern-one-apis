import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { OllamaService } from './ollama/ollama.service';

@Module({
  imports: [ChatModule],
  controllers: [AppController],
  providers: [AppService, OllamaService],
  exports: [OllamaService], // Exporting OllamaService to be used in other modules
})
export class AppModule {}
