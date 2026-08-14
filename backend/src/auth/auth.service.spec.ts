import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { TooManyRequestsException } from "../common/exceptions/too-many-requests.exception";
import * as bcrypt from "bcrypt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-uuid-1",
    email: "owner@goldloan.local",
    passwordHash: "",
    fullName: "Shop Owner",
    role: "OWNER",
    permissions: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMockRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as import("express").Response;
}

function makeMockReq(cookies: Record<string, string> = {}) {
  return { cookies } as unknown as import("express").Request;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("AuthService", () => {
  let service: AuthService;
  let prismaService: { user: { findUnique: jest.Mock } };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed-token"),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset in-memory lockout map between tests via cast
    (service as any).loginFailures.clear();
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------

  describe("login()", () => {
    let dto: LoginDto;
    let mockUser: ReturnType<typeof makeMockUser>;

    beforeEach(async () => {
      const hash = await bcrypt.hash("correctPass1!", 10);
      mockUser = makeMockUser({ passwordHash: hash });
      dto = { email: "owner@goldloan.local", password: "correctPass1!" };
    });

    it("1. returns accessToken and user object on valid credentials", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();

      const result = await service.login(dto, res);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("user");
      expect((result.user as any).id).toBe(mockUser.id);
      expect((result.user as any).email).toBe(mockUser.email);
      expect((result.user as any).fullName).toBe(mockUser.fullName);
      expect((result.user as any).role).toBe(mockUser.role);
      expect((result.user as any).permissions).toEqual(mockUser.permissions);
    });

    it("2. throws UnauthorizedException for unknown email", async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      const res = makeMockRes();

      await expect(service.login(dto, res)).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );
    });

    it("3. throws UnauthorizedException for wrong password, same message as unknown email", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();
      const wrongDto = { ...dto, password: "wrongPassword!" };

      let notFoundError: unknown;
      let wrongPassError: unknown;

      prismaService.user.findUnique.mockResolvedValueOnce(null);
      try {
        await service.login(dto, res);
      } catch (e) {
        notFoundError = e;
      }

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      (service as any).loginFailures.clear();
      try {
        await service.login(wrongDto, res);
      } catch (e) {
        wrongPassError = e;
      }

      expect((notFoundError as UnauthorizedException).message).toBe(
        "Invalid credentials",
      );
      expect((wrongPassError as UnauthorizedException).message).toBe(
        "Invalid credentials",
      );
    });

    it("4. throws UnauthorizedException for inactive user account", async () => {
      prismaService.user.findUnique.mockResolvedValue(
        makeMockUser({ isActive: false }),
      );
      const res = makeMockRes();

      await expect(service.login(dto, res)).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );
    });

    it("5. increments failure count on wrong password", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();
      const wrongDto = { ...dto, password: "wrongPassword!" };

      await expect(service.login(wrongDto, res)).rejects.toThrow(
        UnauthorizedException,
      );

      const record = (service as any).loginFailures.get(
        dto.email.toLowerCase(),
      );
      expect(record).toBeDefined();
      expect(record.count).toBe(1);
    });

    it("6. throws 429 (TooManyRequestsException) after 5 failures within 15 minutes", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();
      const wrongDto = { ...dto, password: "wrongPassword!" };

      // Fail 5 times
      for (let i = 0; i < 5; i++) {
        await expect(service.login(wrongDto, res)).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // 6th attempt should be locked out
      await expect(service.login(wrongDto, res)).rejects.toThrow(
        TooManyRequestsException,
      );
    });

    it("7. resets lockout if 15 minutes have passed", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();
      const wrongDto = { ...dto, password: "wrongPassword!" };

      // Set up 5 failures with an old timestamp (16 minutes ago)
      const oldDate = new Date(Date.now() - 16 * 60 * 1000);
      (service as any).loginFailures.set(dto.email.toLowerCase(), {
        count: 5,
        firstFailedAt: oldDate,
      });

      // Should NOT throw TooManyRequestsException — should proceed to password check
      await expect(service.login(wrongDto, res)).rejects.toThrow(
        UnauthorizedException,
      );
      // And UnauthorizedException (wrong password), not TooManyRequestsException
      await expect(service.login(wrongDto, res)).rejects.not.toThrow(
        TooManyRequestsException,
      );
    });

    it("8. clears failure count on successful login", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();
      const wrongDto = { ...dto, password: "wrongPassword!" };

      // Record some failures
      await expect(service.login(wrongDto, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect((service as any).loginFailures.has(dto.email.toLowerCase())).toBe(
        true,
      );

      // Successful login clears the failures
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      await service.login(dto, res);
      expect((service as any).loginFailures.has(dto.email.toLowerCase())).toBe(
        false,
      );
    });

    it("9. sets httpOnly cookie with refresh token", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();

      await service.login(dto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          path: "/api/v1/auth/refresh",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it("10. never returns passwordHash in response", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      const res = makeMockRes();

      const result = await service.login(dto, res);

      expect(JSON.stringify(result)).not.toContain("passwordHash");
      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // refresh()
  // -------------------------------------------------------------------------

  describe("refresh()", () => {
    const mockUser = makeMockUser();

    it("11. returns new accessToken with valid refresh cookie", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const req = makeMockReq({ refresh_token: "valid-refresh-token" });
      const result = await service.refresh(req);

      expect(result).toHaveProperty("accessToken");
    });

    it("12. throws UnauthorizedException if no cookie present", async () => {
      const req = makeMockReq({});

      await expect(service.refresh(req)).rejects.toThrow(
        new UnauthorizedException("No refresh token provided"),
      );
    });

    it("13. throws UnauthorizedException if refresh token is invalid/expired", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("jwt expired"));
      const req = makeMockReq({ refresh_token: "expired-token" });

      await expect(service.refresh(req)).rejects.toThrow(
        new UnauthorizedException("Invalid or expired refresh token"),
      );
    });

    it("14. throws UnauthorizedException if user is inactive", async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });
      prismaService.user.findUnique.mockResolvedValue(
        makeMockUser({ isActive: false }),
      );

      const req = makeMockReq({ refresh_token: "valid-token" });

      await expect(service.refresh(req)).rejects.toThrow(UnauthorizedException);
    });
  });

  // -------------------------------------------------------------------------
  // logout()
  // -------------------------------------------------------------------------

  describe("logout()", () => {
    it("15. clears the refresh_token cookie", () => {
      const res = makeMockRes();

      const result = service.logout(res);

      expect(res.clearCookie).toHaveBeenCalledWith("refresh_token", {
        path: "/api/v1/auth/refresh",
      });
      expect(result).toEqual({ message: "Logged out successfully" });
    });
  });
});
