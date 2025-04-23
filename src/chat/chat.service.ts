import { Injectable } from '@nestjs/common';
import { OllamaService } from '../ollama/ollama.service';

@Injectable()
export class ChatService {
  constructor(private ollamaService: OllamaService) {}

  async chat(prompt: string) {
    return this.ollamaService.generateResponse(prompt);
  }
}
