import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Role, Permission } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Determine if a user can view all customers (not just their own).
   */
  private canViewAll(user: JwtPayload): boolean {
    return (
      user.role === Role.OWNER ||
      (user.permissions || []).includes(Permission.VIEW_ALL_CUSTOMERS)
    );
  }

  /**
   * Serialize a customer, converting BigInt fields to strings for JSON safety.
   */
  private serializeCustomer(customer: any): any {
    if (!customer) return customer;
    return JSON.parse(
      JSON.stringify(customer, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );
  }

  /**
   * List customers with search and pagination.
   * OWNER and staff with VIEW_ALL_CUSTOMERS see all customers.
   * Other staff see only customers they created.
   */
  async findAll(user: JwtPayload, query: CustomerQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};

    // Scope to created-by for restricted staff
    if (!this.canViewAll(user)) {
      where.createdById = user.sub;
    }

    // isActive filter
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Search filter — ILIKE on fullName, mobileNumber, idProofNumber
    if (query.search) {
      const search = query.search;
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
        { idProofNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          mobileNumber: true,
          address: true,
          idProofType: true,
          idProofNumber: true,
          dateOfBirth: true,
          photoUrl: true,
          idDocumentUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      success: true,
      data: customers.map(this.serializeCustomer),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Create a new customer.
   * Sets createdById to the requesting user's ID.
   * Creates an audit log entry.
   */
  async create(user: JwtPayload, dto: CreateCustomerDto) {
    // Check for duplicate mobile number
    const existing = await this.prisma.customer.findUnique({
      where: { mobileNumber: dto.mobileNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Mobile number ${dto.mobileNumber} is already registered`,
      );
    }

    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          fullName: dto.fullName,
          mobileNumber: dto.mobileNumber,
          address: dto.address,
          idProofType: dto.idProofType,
          idProofNumber: dto.idProofNumber,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          photoUrl: dto.photoUrl,
          idDocumentUrl: dto.idDocumentUrl,
          createdById: user.sub,
        },
      });

      await this.auditService.log(
        {
          eventType: 'CUSTOMER_CREATED',
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: 'Customer',
          affectedId: created.id,
          afterValue: {
            fullName: created.fullName,
            mobileNumber: created.mobileNumber,
            idProofType: created.idProofType,
          },
        },
        tx,
      );

      return created;
    });

    return this.serializeCustomer(customer);
  }

  /**
   * Get a single customer with their loans and gold items.
   * Applies ownership check for restricted staff.
   */
  async findOne(user: JwtPayload, id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        loans: {
          select: {
            id: true,
            loanNumber: true,
            principalPaise: true,
            status: true,
            dueDate: true,
            startDate: true,
            tenureMonths: true,
            monthlyRateBps: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        goldItems: {
          select: {
            id: true,
            description: true,
            weightGrams: true,
            purity: true,
            status: true,
            estimatedValuePaise: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Check ownership for restricted staff
    if (!this.canViewAll(user) && customer.createdById !== user.sub) {
      throw new ForbiddenException('You do not have permission to view this customer');
    }

    return this.serializeCustomer(customer);
  }

  /**
   * Update a customer.
   * Applies ownership check for restricted staff.
   * Creates an audit log with before/after values.
   */
  async update(user: JwtPayload, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Check ownership for restricted staff
    if (!this.canViewAll(user) && customer.createdById !== user.sub) {
      throw new ForbiddenException('You do not have permission to update this customer');
    }

    // Check mobile number conflict if being updated
    if (dto.mobileNumber && dto.mobileNumber !== customer.mobileNumber) {
      const existing = await this.prisma.customer.findUnique({
        where: { mobileNumber: dto.mobileNumber },
      });

      if (existing) {
        throw new ConflictException(
          `Mobile number ${dto.mobileNumber} is already registered`,
        );
      }
    }

    // Capture before value for audit
    const beforeValue = {
      fullName: customer.fullName,
      mobileNumber: customer.mobileNumber,
      address: customer.address,
      idProofType: customer.idProofType,
      idProofNumber: customer.idProofNumber,
      dateOfBirth: customer.dateOfBirth,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customer.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.mobileNumber !== undefined && { mobileNumber: dto.mobileNumber }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.idProofType !== undefined && { idProofType: dto.idProofType }),
          ...(dto.idProofNumber !== undefined && { idProofNumber: dto.idProofNumber }),
          ...(dto.dateOfBirth !== undefined && {
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          }),
        },
      });

      const afterValue = {
        fullName: result.fullName,
        mobileNumber: result.mobileNumber,
        address: result.address,
        idProofType: result.idProofType,
        idProofNumber: result.idProofNumber,
        dateOfBirth: result.dateOfBirth,
      };

      await this.auditService.log(
        {
          eventType: 'CUSTOMER_UPDATED',
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: 'Customer',
          affectedId: id,
          beforeValue,
          afterValue,
        },
        tx,
      );

      return result;
    });

    return this.serializeCustomer(updated);
  }
}
