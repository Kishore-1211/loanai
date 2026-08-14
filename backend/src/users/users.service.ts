import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { AuditEventType, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdatePermissionsDto } from "./dto/update-permissions.dto";
import { UserQueryDto } from "./dto/user-query.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private omitPasswordHash(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }

  // ----------------------------------------------------------------
  // findAll
  // ----------------------------------------------------------------

  async findAll(query: UserQueryDto) {
    const where: Record<string, any> = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users;
  }

  // ----------------------------------------------------------------
  // findOne
  // ----------------------------------------------------------------

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  // ----------------------------------------------------------------
  // create
  // ----------------------------------------------------------------

  async create(requestingUser: JwtPayload, dto: CreateUserDto) {
    // Check for duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException("Email address is already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          role: Role.STAFF,
          permissions: dto.permissions ?? [],
        },
      });

      await this.auditService.log(
        {
          eventType: AuditEventType.USER_CREATED,
          performedById: requestingUser.sub,
          performedByName: requestingUser.email,
          affectedModel: "User",
          affectedId: created.id,
          afterValue: {
            email: created.email,
            fullName: created.fullName,
            role: created.role,
            permissions: created.permissions,
          },
        },
        tx,
      );

      return created;
    });

    return this.omitPasswordHash(newUser);
  }

  // ----------------------------------------------------------------
  // update
  // ----------------------------------------------------------------

  async update(requestingUser: JwtPayload, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const beforeValue = {
      fullName: user.fullName,
      isActive: user.isActive,
    };

    const updateData: Record<string, any> = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
      });

      // Only audit deactivation events — no suitable AuditEventType for name-only changes
      if (dto.isActive === false) {
        await this.auditService.log(
          {
            eventType: AuditEventType.USER_DEACTIVATED,
            performedById: requestingUser.sub,
            performedByName: requestingUser.email,
            affectedModel: "User",
            affectedId: id,
            beforeValue,
            afterValue: { isActive: false },
          },
          tx,
        );
      }

      return updated;
    });

    return this.omitPasswordHash(updatedUser);
  }

  // ----------------------------------------------------------------
  // updatePermissions
  // ----------------------------------------------------------------

  async updatePermissions(
    requestingUser: JwtPayload,
    id: string,
    dto: UpdatePermissionsDto,
  ) {
    if (id === requestingUser.sub) {
      throw new ForbiddenException("You cannot modify your own permissions");
    }

    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const beforePermissions = user.permissions;

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { permissions: dto.permissions },
      });

      await this.auditService.log(
        {
          eventType: AuditEventType.USER_PERMISSION_CHANGED,
          performedById: requestingUser.sub,
          performedByName: requestingUser.email,
          affectedModel: "User",
          affectedId: id,
          beforeValue: { permissions: beforePermissions },
          afterValue: { permissions: updated.permissions },
        },
        tx,
      );

      return updated;
    });

    return {
      id: updatedUser.id,
      permissions: updatedUser.permissions,
    };
  }
}
