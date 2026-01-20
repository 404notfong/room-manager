import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    @Get('/')
    checkHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        };
    }
}
