import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
  // This is a health check endpoint
  getHealth(): string {
    return 'Health is Okay !!!!';
  }
}
