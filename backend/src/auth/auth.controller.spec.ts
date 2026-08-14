import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, "login" | "refresh" | "logout">
  >;

  const mockLoginResult = {
    accessToken: "mock-access-token",
    user: {
      id: "1",
      email: "owner@goldloan.local",
      fullName: "Owner",
      role: "OWNER",
      permissions: [],
    },
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue(mockLoginResult),
      refresh: jest.fn().mockResolvedValue({ accessToken: "new-access-token" }),
      logout: jest.fn().mockReturnValue({ message: "Logged out successfully" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("1. Controller is defined", () => {
    expect(controller).toBeDefined();
  });

  it("2. login delegates to authService.login", async () => {
    const dto: LoginDto = {
      email: "owner@goldloan.local",
      password: "ChangeMe123!",
    };
    const mockRes = { cookie: jest.fn() } as any;

    const result = await controller.login(dto, mockRes);

    expect(authService.login).toHaveBeenCalledWith(dto, mockRes);
    expect(result).toEqual(mockLoginResult);
  });

  it("3. refresh delegates to authService.refresh", async () => {
    const mockReq = { cookies: { refresh_token: "valid-token" } } as any;

    const result = await controller.refresh(mockReq);

    expect(authService.refresh).toHaveBeenCalledWith(mockReq);
    expect(result).toEqual({ accessToken: "new-access-token" });
  });

  it("4. logout delegates to authService.logout", () => {
    const mockRes = { clearCookie: jest.fn() } as any;

    const result = controller.logout(mockRes);

    expect(authService.logout).toHaveBeenCalledWith(mockRes);
    expect(result).toEqual({ message: "Logged out successfully" });
  });
});
