import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, Permission, IdProofType } from '@prisma/client';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

// ----------------------------------------------------------------
// Mock helpers
// ----------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: 'owner-id',
  email: 'owner@example.com',
  role: Role.OWNER,
  permissions: [],
});

const makeStaff = (permissions: Permission[] = []): JwtPayload => ({
  sub: 'staff-id',
  email: 'staff@example.com',
  role: Role.STAFF,
  permissions,
});

const makeCustomer = (overrides: Partial<any> = {}) => ({
  id: 'cust-1',
  fullName: 'Ramesh Kumar',
  mobileNumber: '9876543210',
  address: '123 Main Street, Chennai',
  idProofType: IdProofType.AADHAAR,
  idProofNumber: '1234-5678-9012',
  dateOfBirth: null,
  photoUrl: null,
  idDocumentUrl: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdById: 'owner-id',
  ...overrides,
});

// ----------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------

const mockPrismaService = {
  customer: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  log: jest.fn(),
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);

    jest.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // create()
  // ----------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateCustomerDto = {
      fullName: 'Ramesh Kumar',
      mobileNumber: '9876543210',
      address: '123 Main Street, Chennai',
      idProofType: IdProofType.AADHAAR,
      idProofNumber: '1234-5678-9012',
    };

    it('should create a customer, set createdById, and create audit log', async () => {
      const user = makeOwner();
      const createdCustomer = makeCustomer({ createdById: user.sub });

      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          customer: { create: jest.fn().mockResolvedValue(createdCustomer) },
          auditLog: { create: jest.fn() },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const result = await service.create(user, dto);

      expect(result.fullName).toBe('Ramesh Kumar');
      expect(result.createdById).toBe(user.sub);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CUSTOMER_CREATED',
          performedById: user.sub,
          affectedModel: 'Customer',
        }),
        expect.anything(),
      );
    });

    it('should throw ConflictException when mobile number already exists', async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(makeCustomer());

      await expect(service.create(user, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ----------------------------------------------------------------
  // findAll()
  // ----------------------------------------------------------------

  describe('findAll()', () => {
    it('should return all customers for OWNER', async () => {
      const user = makeOwner();
      const customers = [makeCustomer(), makeCustomer({ id: 'cust-2', mobileNumber: '9999999999' })];

      mockPrismaService.customer.findMany.mockResolvedValue(customers);
      mockPrismaService.customer.count.mockResolvedValue(2);

      const result = await service.findAll(user, { page: 1, pageSize: 20 });

      // Owner should not have createdById filter
      const findManyCall = mockPrismaService.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.createdById).toBeUndefined();
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should return only own customers for STAFF without VIEW_ALL_CUSTOMERS', async () => {
      const user = makeStaff([]);
      const ownCustomers = [makeCustomer({ createdById: 'staff-id' })];

      mockPrismaService.customer.findMany.mockResolvedValue(ownCustomers);
      mockPrismaService.customer.count.mockResolvedValue(1);

      const result = await service.findAll(user, { page: 1, pageSize: 20 });

      const findManyCall = mockPrismaService.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.createdById).toBe('staff-id');
      expect(result.data).toHaveLength(1);
    });

    it('should return all customers for STAFF with VIEW_ALL_CUSTOMERS', async () => {
      const user = makeStaff([Permission.VIEW_ALL_CUSTOMERS]);
      const customers = [makeCustomer(), makeCustomer({ id: 'cust-2', mobileNumber: '9999999999', createdById: 'other-staff' })];

      mockPrismaService.customer.findMany.mockResolvedValue(customers);
      mockPrismaService.customer.count.mockResolvedValue(2);

      const result = await service.findAll(user, { page: 1, pageSize: 20 });

      const findManyCall = mockPrismaService.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.createdById).toBeUndefined();
      expect(result.data).toHaveLength(2);
    });

    it('should apply search filter when search param is provided', async () => {
      const user = makeOwner();

      mockPrismaService.customer.findMany.mockResolvedValue([]);
      mockPrismaService.customer.count.mockResolvedValue(0);

      await service.findAll(user, { page: 1, pageSize: 20, search: 'Ramesh' });

      const findManyCall = mockPrismaService.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(3);
      expect(findManyCall.where.OR[0]).toEqual({
        fullName: { contains: 'Ramesh', mode: 'insensitive' },
      });
    });

    it('should apply correct pagination (page, pageSize, total, totalPages)', async () => {
      const user = makeOwner();
      const customers = Array.from({ length: 5 }, (_, i) =>
        makeCustomer({ id: `cust-${i}`, mobileNumber: `987654321${i}` }),
      );

      mockPrismaService.customer.findMany.mockResolvedValue(customers);
      mockPrismaService.customer.count.mockResolvedValue(50);

      const result = await service.findAll(user, { page: 2, pageSize: 5 });

      const findManyCall = mockPrismaService.customer.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(5);
      expect(findManyCall.take).toBe(5);
      expect(result.meta.page).toBe(2);
      expect(result.meta.pageSize).toBe(5);
      expect(result.meta.total).toBe(50);
      expect(result.meta.totalPages).toBe(10);
    });
  });

  // ----------------------------------------------------------------
  // findOne()
  // ----------------------------------------------------------------

  describe('findOne()', () => {
    it('should allow OWNER to access any customer', async () => {
      const user = makeOwner();
      const customer = makeCustomer({ createdById: 'some-other-staff' });

      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...customer,
        loans: [],
        goldItems: [],
      });

      const result = await service.findOne(user, 'cust-1');
      expect(result.id).toBe('cust-1');
    });

    it('should allow STAFF with VIEW_ALL_CUSTOMERS to access any customer', async () => {
      const user = makeStaff([Permission.VIEW_ALL_CUSTOMERS]);
      const customer = makeCustomer({ createdById: 'different-staff' });

      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...customer,
        loans: [],
        goldItems: [],
      });

      const result = await service.findOne(user, 'cust-1');
      expect(result.id).toBe('cust-1');
    });

    it('should allow STAFF without VIEW_ALL_CUSTOMERS to access their own customer', async () => {
      const user = makeStaff([]);
      const customer = makeCustomer({ createdById: 'staff-id' }); // same as user.sub

      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...customer,
        loans: [],
        goldItems: [],
      });

      const result = await service.findOne(user, 'cust-1');
      expect(result.id).toBe('cust-1');
    });

    it('should throw ForbiddenException when STAFF without VIEW_ALL_CUSTOMERS tries to access another staff customer', async () => {
      const user = makeStaff([]);
      const customer = makeCustomer({ createdById: 'different-staff-id' }); // NOT user.sub

      mockPrismaService.customer.findUnique.mockResolvedValue({
        ...customer,
        loans: [],
        goldItems: [],
      });

      await expect(service.findOne(user, 'cust-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent customer', async () => {
      const user = makeOwner();
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne(user, 'non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------------
  // update()
  // ----------------------------------------------------------------

  describe('update()', () => {
    const dto: UpdateCustomerDto = {
      fullName: 'Ramesh Kumar Updated',
      address: '456 New Street, Chennai',
    };

    it('should update customer and create audit log with before/after values', async () => {
      const user = makeOwner();
      const existingCustomer = makeCustomer();
      const updatedCustomer = makeCustomer({ fullName: 'Ramesh Kumar Updated', address: '456 New Street, Chennai' });

      mockPrismaService.customer.findUnique.mockResolvedValue(existingCustomer);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          customer: { update: jest.fn().mockResolvedValue(updatedCustomer) },
        };
        mockAuditService.log.mockResolvedValue(undefined);
        return fn(tx);
      });

      const result = await service.update(user, 'cust-1', dto);

      expect(result.fullName).toBe('Ramesh Kumar Updated');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'CUSTOMER_UPDATED',
          performedById: user.sub,
          affectedModel: 'Customer',
          affectedId: 'cust-1',
          beforeValue: expect.objectContaining({ fullName: 'Ramesh Kumar' }),
          afterValue: expect.objectContaining({ fullName: 'Ramesh Kumar Updated' }),
        }),
        expect.anything(),
      );
    });

    it('should throw ConflictException when updating to an already-taken mobile number', async () => {
      const user = makeOwner();
      const existingCustomer = makeCustomer();
      const conflictingCustomer = makeCustomer({ id: 'cust-2', mobileNumber: '8888888888' });

      // First call: fetch the customer to update
      // Second call: check if new mobile already exists
      mockPrismaService.customer.findUnique
        .mockResolvedValueOnce(existingCustomer) // existing customer
        .mockResolvedValueOnce(conflictingCustomer); // conflict on mobile

      await expect(
        service.update(user, 'cust-1', { mobileNumber: '8888888888' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when STAFF without VIEW_ALL_CUSTOMERS tries to update another customer', async () => {
      const user = makeStaff([Permission.CREATE_CUSTOMER]);
      const customer = makeCustomer({ createdById: 'different-staff' }); // not staff-id

      mockPrismaService.customer.findUnique.mockResolvedValue(customer);

      await expect(service.update(user, 'cust-1', dto)).rejects.toThrow(ForbiddenException);
    });
  });
});
