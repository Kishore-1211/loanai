import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { OwnerOnly } from "../common/decorators/owner-only.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtPayload } from "../common/types/jwt-payload.type";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdatePermissionsDto } from "./dto/update-permissions.dto";
import { UserQueryDto } from "./dto/user-query.dto";

@OwnerOnly()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Patch(":id/permissions")
  updatePermissions(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.usersService.updatePermissions(user, id, dto);
  }
}
