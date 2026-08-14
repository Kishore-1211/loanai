import { Test, TestingModule } from '@nestjs/testing';
import { Role, IdProofType } from '@prisma/client';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { JwtPayload } from '../common/types/jwt-payload.type';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

// ----------------------------------------------------------------
// Mock helpers
// ----------------------------------------------------------------

const makeOwner = (): JwtPayload => ({
  sub: 'owner-id',
  email: 'owner@example.com',
  role: Role.OWNER,
  permissions: [],
});

const makeCustomer = (overrides: Partial<any> = {}) => ({
  id: 'cust-1',
  fullName: 'Ramesh Kumar',
  mobileNumber: '9876543210',
  address: '123 Main Street, Chennai',
  idProofType: 'AADHAAR',
  idProofNumber: '1234-5678-9012',
  dateOfBirth: null,
  photoUrl: null,
  idDocumentUrl: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdById: 'owner-id',
  ...overrides,
});

// ----------------------------------------------------------------
// Mock service
// ----------------------------------------------------------------

const mockCustomersService = {
  findAll: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('CustomersController', () => {
  let controller: CustomersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomersService, useValue: mockCustomersService },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll()', () => {
    it('should delegate to CustomersService.findAll and return its result', async () => {
      const user = makeOwner();
      const query: CustomerQueryDto = { page: 1, pageSize: 20 };
      const expectedResult = {
        success: true,
        data: [makeCustomer()],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };

      mockCustomersService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(user, query);

      expect(mockCustomersService.findAll).toHaveBeenCalledWith(user, query);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('create()', () => {
    it('should delegate to CustomersService.create and return the created customer', async () => {
      const user = makeOwner();
      const dto: CreateCustomerDto = {
        fullName: 'Ramesh Kumar',
        mobileNumber: '9876543210',
        address: '123 Main Street, Chennai',
        idProofType: IdProofType.AADHAAR,
        idProofNumber: '1234-5678-9012',
      };
      const customer = makeCustomer();

      mockCustomersService.create.mockResolvedValue(customer);

      const result = await controller.create(user, dto);

      expect(mockCustomersService.create).toHaveBeenCalledWith(user, dto);
      expect(result).toEqual(customer);
    });
  });

  describe('findOne()', () => {
    it('should delegate to CustomersService.findOne with correct id', async () => {
      const user = makeOwner();
      const customer = { ...makeCustomer(), loans: [], goldItems: [] };

      mockCustomersService.findOne.mockResolvedValue(customer);

      const result = await controller.findOne(user, 'cust-1');

      expect(mockCustomersService.findOne).toHaveBeenCalledWith(user, 'cust-1');
      expect(result).toEqual(customer);
    });
  });

  describe('update()', () => {
    it('should delegate to CustomersService.update with correct id and dto', async () => {
      const user = makeOwner();
      const dto = { fullName: 'Ramesh Kumar Updated' };
      const updatedCustomer = makeCustomer({ fullName: 'Ramesh Kumar Updated' });

      mockCustomersService.update.mockResolvedValue(updatedCustomer);

      const result = await controller.update(user, 'cust-1', dto);

      expect(mockCustomersService.update).toHaveBeenCalledWith(user, 'cust-1', dto);
      expect(result).toEqual(updatedCustomer);
    });
  });
});
