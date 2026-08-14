import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateGoldItemDto } from "./dto/create-gold-item.dto";
import { UpdateGoldItemDto } from "./dto/update-gold-item.dto";

@Injectable()
export class GoldItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Serialize a gold item, converting BigInt fields to strings for JSON safety.
   */
  private serialize(item: any): any {
    if (!item) return item;
    return JSON.parse(
      JSON.stringify(item, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  }

  /**
   * Create a new gold item linked to a customer.
   * loanId defaults to null (linked during loan creation in TASK-005).
   * Status defaults to PLEDGED (schema default).
   */
  async create(user: JwtPayload, dto: CreateGoldItemDto) {
    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Verify customer is active
    if (!customer.isActive) {
      throw new UnprocessableEntityException("Customer account is inactive");
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.goldItem.create({
        data: {
          customerId: dto.customerId,
          description: dto.description,
          weightGrams: dto.weightGrams,
          purity: dto.purity,
          estimatedValuePaise: BigInt(dto.estimatedValuePaise),
          conditionNotes: dto.conditionNotes,
          photoUrl: dto.photoUrl,
          // status defaults to PLEDGED, loanId defaults to null
        },
      });

      await this.auditService.log(
        {
          eventType: "GOLD_ITEM_CREATED",
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: "GoldItem",
          affectedId: created.id,
          afterValue: {
            description: dto.description,
            purity: dto.purity,
            weightGrams: dto.weightGrams,
            customerId: dto.customerId,
          },
        },
        tx,
      );

      return created;
    });

    return this.serialize(item);
  }

  /**
   * Get a single gold item with its customer and loan references.
   */
  async findOne(id: string) {
    const item = await this.prisma.goldItem.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            mobileNumber: true,
          },
        },
        loan: {
          select: {
            id: true,
            loanNumber: true,
            status: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException("Gold item not found");
    }

    return this.serialize(item);
  }

  /**
   * Update a gold item's description and/or conditionNotes (OWNER only).
   * Other fields (status, loanId, estimatedValuePaise) are immutable via this endpoint.
   */
  async update(user: JwtPayload, id: string, dto: UpdateGoldItemDto) {
    const existing = await this.prisma.goldItem.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Gold item not found");
    }

    // Capture before value for audit
    const beforeValue = {
      description: existing.description,
      conditionNotes: existing.conditionNotes,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.goldItem.update({
        where: { id },
        data: {
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.conditionNotes !== undefined && {
            conditionNotes: dto.conditionNotes,
          }),
        },
      });

      const afterValue = {
        description: result.description,
        conditionNotes: result.conditionNotes,
      };

      await this.auditService.log(
        {
          eventType: "GOLD_ITEM_UPDATED",
          performedById: user.sub,
          performedByName: user.email,
          affectedModel: "GoldItem",
          affectedId: id,
          beforeValue,
          afterValue,
        },
        tx,
      );

      return result;
    });

    return this.serialize(updated);
  }
}
