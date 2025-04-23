// src/chat/dto/chat-request.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiProperty({ description: 'The message from the user' })
  @IsString()
  message: string;
}
