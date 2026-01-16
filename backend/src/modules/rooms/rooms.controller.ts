import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, UpdateRoomDto, UpdateIndexesDto, GetRoomsDto } from './dto/room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createRoomDto: CreateRoomDto) {
        return this.roomsService.create(user.userId, createRoomDto);
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

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.roomsService.remove(id, user.userId);
    }
}
