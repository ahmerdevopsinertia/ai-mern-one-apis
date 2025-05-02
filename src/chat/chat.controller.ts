import { Controller, Post, Body } from '@nestjs/common';
import { AIService } from '../ai/ai.service';

@Controller('chat')
export class ChatController {
  constructor(private aiService: AIService) {}

  @Post()
  async chat(@Body() { message }: { message: string }) {
    // Input validation
    if (!this.isHRQuestion(message)) {
      return {
        reply: "I specialize in school staff policies. Please ask HR-related questions.",
        sources: []
      };
    }

    return this.aiService.handleQuery(message);
  }

  private isHRQuestion(text: string): boolean {
    const keywords = ['leave', 'policy', 'attendance', 'staff'];
    return keywords.some(keyword => text.toLowerCase().includes(keyword));
  }
}