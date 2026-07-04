import { invalidateCache, CacheKeys } from './cache';

/**
 * Service to handle business-scoped cache invalidation.
 * Centralizes rules for which entities affect which caches.
 */
export const CacheInvalidation = {
  async invalidateDashboard(businessId: string) {
    await invalidateCache(CacheKeys.dashboard(businessId));
  },

  async invalidateProduct(businessId: string, productId?: string) {
    const promises = [
      invalidateCache(CacheKeys.productList(businessId)),
      this.invalidateDashboard(businessId),
    ];
    if (productId) {
      promises.push(invalidateCache(CacheKeys.product(businessId, productId)));
    }
    await Promise.all(promises).catch(console.error);
  },

  async invalidateCustomer(businessId: string, customerId?: string) {
    const promises = [
      invalidateCache(CacheKeys.customerList(businessId)),
      this.invalidateDashboard(businessId),
    ];
    if (customerId) {
      promises.push(invalidateCache(CacheKeys.customer(businessId, customerId)));
    }
    await Promise.all(promises).catch(console.error);
  },

  async invalidateSale(businessId: string) {
    await this.invalidateDashboard(businessId);
    // Future: invalidate sales reports, recent sales list, etc.
  },

  async invalidateExpense(businessId: string) {
    await this.invalidateDashboard(businessId);
  },

  async invalidatePurchase(businessId: string) {
    await this.invalidateDashboard(businessId);
  },

  async invalidateBusinessSettings(businessId: string) {
    await invalidateCache(CacheKeys.businessSettings(businessId));
    await invalidateCache(CacheKeys.business(businessId));
  },

  async invalidateInventory(businessId: string) {
    // Inventory movements, rebuilds, adjustments
    const promises = [
      invalidateCache(CacheKeys.productList(businessId)),
      this.invalidateDashboard(businessId),
    ];
    await Promise.all(promises).catch(console.error);
  },
};
