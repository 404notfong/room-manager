import { Controller, Get, Patch, Param, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    findAll(
        @CurrentUser() user: any,
        @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
        @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    ) {
        return this.notificationsService.findAll(user.userId, page, limit);
    }

    @Get('unread-count')
    countUnread(@CurrentUser() user: any) {
        return this.notificationsService.countUnread(user.userId);
    }

    @Patch('read-all')
    markAllAsRead(@CurrentUser() user: any) {
        return this.notificationsService.markAllAsRead(user.userId);
    }

    @Patch(':id/read')
    markAsRead(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.notificationsService.markAsRead(id, user.userId);
    }
}
