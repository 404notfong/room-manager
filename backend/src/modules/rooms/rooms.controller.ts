import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CreateRoomDto, DashboardRoomsDto, GetRoomsDto, ReorderRoomsDto, UpdateIndexesDto, UpdateRoomDto } from '@modules/rooms/dto/room.dto';
import { RoomsService } from '@modules/rooms/rooms.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createRoomDto: CreateRoomDto) {
        return this.roomsService.create(user.userId, createRoomDto);
    }

    @Get('dashboard')
    getDashboard(@CurrentUser() user: any, @Query() query: DashboardRoomsDto) {
        return this.roomsService.getDashboard(user.userId, query);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: GetRoomsDto) {
        return this.roomsService.findAll(user.userId, query);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.roomsService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() updateRoomDto: UpdateRoomDto) {
        return this.roomsService.update(id, user.userId, updateRoomDto);
    }

    @Put(':id/indexes')
    updateIndexes(@Param('id') id: string, @CurrentUser() user: any, @Body() updateIndexesDto: UpdateIndexesDto) {
        return this.roomsService.updateIndexes(id, user.userId, updateIndexesDto);
    }

    @Patch('reorder')
    reorderRooms(@CurrentUser() user: any, @Body() reorderDto: ReorderRoomsDto) {
        return this.roomsService.reorderRooms(user.userId, reorderDto.items);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.roomsService.remove(id, user.userId);
    }
}
