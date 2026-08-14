import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { TooManyRequestsException } from "../common/exceptions/too-many-requests.exception";

interface FailureRecord {
  count: number;
  firstFailedAt: Date;
}

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class AuthService {
  // In-memory store for login failure tracking (per email)
  private readonly loginFailures = new Map<string, FailureRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    dto: LoginDto,
    res: Response,
  ): Promise<{ accessToken: string; user: object }> {
    const emailKey = dto.email.toLowerCase();

    // Check lockout BEFORE hitting the database for the password
    this.checkLockout(emailKey);

    // Find user — same error for not found or inactive (no info leakage)
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      this.recordFailure(emailKey);
      throw new UnauthorizedException("Invalid credentials");
    }

    // Successful login — clear failure record
    this.loginFailures.delete(emailKey);

    // Issue access token
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };
    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: process.env.JWT_SECRET || "fallback-secret-change-in-production",
      expiresIn: "15m",
    });

    // Issue refresh token (minimal payload, different secret)
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret:
          process.env.JWT_REFRESH_SECRET ||
          "fallback-refresh-secret-change-in-production",
        expiresIn: "7d",
      },
    );

    // Set refresh token as httpOnly cookie
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }

  async refresh(req: Request): Promise<{ accessToken: string }> {
    const refreshToken = (req.cookies as Record<string, string>)?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException("No refresh token provided");
    }

    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(
        refreshToken,
        {
          secret:
            process.env.JWT_REFRESH_SECRET ||
            "fallback-refresh-secret-change-in-production",
        },
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
      {
        secret:
          process.env.JWT_SECRET || "fallback-secret-change-in-production",
        expiresIn: "15m",
      },
    );

    return { accessToken };
  }

  logout(res: Response): { message: string } {
    res.clearCookie("refresh_token", { path: "/api/v1/auth/refresh" });
    return { message: "Logged out successfully" };
  }

  // ── Private helpers ───────────────────────────────────────────

  private checkLockout(emailKey: string): void {
    const record = this.loginFailures.get(emailKey);
    if (!record) return;

    const now = Date.now();
    const elapsed = now - record.firstFailedAt.getTime();

    if (elapsed >= LOCKOUT_WINDOW_MS) {
      // Window has expired — reset
      this.loginFailures.delete(emailKey);
      return;
    }

    if (record.count >= LOCKOUT_MAX_ATTEMPTS) {
      throw new TooManyRequestsException(
        "Too many failed login attempts. Please try again in 15 minutes.",
      );
    }
  }

  private recordFailure(emailKey: string): void {
    const existing = this.loginFailures.get(emailKey);
    if (existing) {
      const elapsed = Date.now() - existing.firstFailedAt.getTime();
      if (elapsed >= LOCKOUT_WINDOW_MS) {
        // Old window — start fresh
        this.loginFailures.set(emailKey, {
          count: 1,
          firstFailedAt: new Date(),
        });
      } else {
        existing.count += 1;
      }
    } else {
      this.loginFailures.set(emailKey, { count: 1, firstFailedAt: new Date() });
    }
  }
}
