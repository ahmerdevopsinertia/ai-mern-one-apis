import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { OLLAMA_API_URL, OLLAMA_MODEL_NAME } from './ollama.constants';

@Injectable()
export class OllamaService {
  async generateResponse(prompt: string): Promise<string> {
    const response = await axios.post(
      OLLAMA_API_URL,
      {
        model: OLLAMA_MODEL_NAME,
        prompt: prompt,
        stream: false, // Change to true for streaming later
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.response || 'No response';
  }
}
