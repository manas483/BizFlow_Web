import { prisma } from '@/shared/lib/db';

export class WarehouseService {
  static async getWarehouses(businessId: string) {
    return prisma.warehouse.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async createWarehouse(data: { name: string, location?: string, isDefault?: boolean }, businessId: string) {
    return prisma.$transaction(async (tx) => {
      // If this is the default warehouse, unset others
      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { businessId, isDefault: true },
          data: { isDefault: false }
        });
      }

      return tx.warehouse.create({
        data: {
          ...data,
          businessId,
        }
      });
    });
  }

  static async updateWarehouse(id: string, data: { name?: string, location?: string, isDefault?: boolean }, businessId: string) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.warehouse.updateMany({
          where: { businessId, isDefault: true, id: { not: id } },
          data: { isDefault: false }
        });
      }

      return tx.warehouse.updateMany({
        where: { id, businessId },
        data
      });
    });
  }

  static async deleteWarehouse(id: string, businessId: string) {
    // Basic delete
    return prisma.warehouse.delete({
      where: { id }
    });
  }
}
