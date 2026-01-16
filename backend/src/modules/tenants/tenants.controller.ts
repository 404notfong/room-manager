import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, GetTenantsDto } from './dto/tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
    constructor(private readonly tenantsService: TenantsService) { }

    @Post()
    create(@CurrentUser() user: any, @Body() createTenantDto: CreateTenantDto) {
        return this.tenantsService.create(user.userId, createTenantDto);
    }

    @Get()
    findAll(@CurrentUser() user: any, @Query() query: GetTenantsDto) {
        return this.tenantsService.findAll(user.userId, query);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.tenantsService.findOne(id, user.userId);
    }

    @Put(':id')
    update(@Param('id') id: string, @CurrentUser() user: any, @Body() updateTenantDto: UpdateTenantDto) {
        return this.tenantsService.update(id, user.userId, updateTenantDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentUser() user: any) {
        return this.tenantsService.remove(id, user.userId);
    }
}
