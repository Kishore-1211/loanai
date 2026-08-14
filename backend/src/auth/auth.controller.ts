import { Controller, Post, Body, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../common/decorators/public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request) {
    return this.authService.refresh(req);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }
}
