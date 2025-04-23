import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ApiBody, ApiTags } from '@nestjs/swagger';


@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiBody({ type: ChatRequestDto }) // 👈 this makes Swagger recognize it
  async handleChat(@Body('message') message: string) {
    const response = await this.chatService.chat(message);
    return { reply: response };
  }
}
