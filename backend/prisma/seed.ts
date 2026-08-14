import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create default owner account
  const existingOwner = await prisma.user.findUnique({
    where: { email: 'owner@goldloan.local' },
  });

  if (!existingOwner) {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
    await prisma.user.create({
      data: {
        email: 'owner@goldloan.local',
        passwordHash,
        fullName: 'Shop Owner',
        role: 'OWNER',
        permissions: [],
        isActive: true,
      },
    });
    console.log('Default owner account created: owner@goldloan.local / ChangeMe123!');
  } else {
    console.log('Owner account already exists, skipping.');
  }

  // Create default BusinessSettings (singleton)
  const existingSettings = await prisma.businessSettings.findUnique({
    where: { id: 'singleton' },
  });

  if (!existingSettings) {
    await prisma.businessSettings.create({
      data: {
        id: 'singleton',
        businessName: 'My Gold Loans',
        businessAddress: '123 Main Street, Chennai, Tamil Nadu',
        businessPhone: null,
        defaultMonthlyRateBps: 200,
        defaultInterestType: 'FLAT_MONTHLY',
        defaultTenureMonths: 3,
        currencySymbol: 'Rs.',
        receiptFooterText: 'Thank you for your business. Please keep this receipt.',
      },
    });
    console.log('Default business settings created.');
  } else {
    console.log('Business settings already exist, skipping.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
