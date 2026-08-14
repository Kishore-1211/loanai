import { Module } from "@nestjs/common";
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CustomersModule } from "./customers/customers.module";
import { UsersModule } from "./users/users.module";
import { GoldItemsModule } from "./gold-items/gold-items.module";
import { LoansModule } from "./loans/loans.module";
import { PaymentsModule } from "./payments/payments.module";
import { ReceiptsModule } from "./receipts/receipts.module";
import { ReportsModule } from "./reports/reports.module";
import { SettingsModule } from "./settings/settings.module";
import { AiModule } from "./ai/ai.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // JWT module (global)
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "fallback-secret-change-in-production",
      signOptions: { expiresIn: "15m" },
    }),

    // Infrastructure modules
    PrismaModule,
    AuditModule,

    // Feature modules
    AuthModule,
    CustomersModule,
    UsersModule,
    GoldItemsModule,
    LoansModule,
    PaymentsModule,
    ReceiptsModule,
    ReportsModule,
    SettingsModule,
    AiModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // Global filter
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
