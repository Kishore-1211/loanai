import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Permission } from '@prisma/client';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../common/types/jwt-payload.type';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * GET /api/v1/customers
   * List customers with search and pagination.
   * OWNER and staff with VIEW_ALL_CUSTOMERS see all customers.
   * Other staff see only their own customers.
   */
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customersService.findAll(user, query);
  }

  /**
   * POST /api/v1/customers
   * Create a new customer.
   * Requires CREATE_CUSTOMER permission.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CREATE_CUSTOMER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(user, dto);
  }

  /**
   * GET /api/v1/customers/:id
   * Get a customer with their loans and gold items.
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.customersService.findOne(user, id);
  }

  /**
   * PATCH /api/v1/customers/:id
   * Update a customer.
   * Requires CREATE_CUSTOMER permission (same as create).
   */
  @Patch(':id')
  @RequirePermissions(Permission.CREATE_CUSTOMER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user, id, dto);
  }

  /**
   * POST /api/v1/customers/:id/photo
   * Upload customer photo — stub (Supabase integration pending).
   */
  @Post(':id/photo')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  uploadPhoto(@Param('id') _id: string) {
    throw new HttpException(
      'Photo upload via Supabase Storage is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  /**
   * POST /api/v1/customers/:id/document
   * Upload customer ID document — stub (Supabase integration pending).
   */
  @Post(':id/document')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  uploadDocument(@Param('id') _id: string) {
    throw new HttpException(
      'Document upload via Supabase Storage is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
