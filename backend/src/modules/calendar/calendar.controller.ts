import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { GetCalendarEventsDto } from './dto/calendar-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
    constructor(private readonly calendarService: CalendarService) { }

    /**
     * Get calendar events within date range
     * GET /calendar/events?start=&end=&buildingId=&type=
     */
    @Get('events')
    async getEvents(@Query() query: GetCalendarEventsDto, @Req() req: any) {
        const ownerId = req.user.userId;
        const startDate = new Date(query.start);
        const endDate = new Date(query.end);

        let events = await this.calendarService.getEventsInRange(
            ownerId,
            startDate,
            endDate,
            query.buildingId,
        );

        // Filter by type if specified
        if (query.type) {
            events = events.filter(e => e.type === query.type);
        }

        return events;
    }

    /**
     * Get events for a specific day
     * GET /calendar/day?date=&buildingId=
     */
    @Get('day')
    async getDayEvents(
        @Query('date') date: string,
        @Query('buildingId') buildingId: string,
        @Req() req: any,
    ) {
        const ownerId = req.user.userId;
        return this.calendarService.getEventsByDay(ownerId, new Date(date), buildingId);
    }

    /**
     * Get monthly summary with event counts per day
     * GET /calendar/month-summary?year=&month=&buildingId=
     */
    @Get('month-summary')
    async getMonthSummary(
        @Query('year') year: string,
        @Query('month') month: string,
        @Query('buildingId') buildingId: string,
        @Req() req: any,
    ) {
        const ownerId = req.user.userId;
        return this.calendarService.getMonthSummary(
            ownerId,
            parseInt(year),
            parseInt(month),
            buildingId,
        );
    }

    /**
     * Get all currently overdue events
     * GET /calendar/overdue?buildingId=
     */
    @Get('overdue')
    async getOverdue(
        @Query('buildingId') buildingId: string,
        @Req() req: any,
    ) {
        const ownerId = req.user.userId;
        return this.calendarService.getOverdue(ownerId, buildingId);
    }
}
