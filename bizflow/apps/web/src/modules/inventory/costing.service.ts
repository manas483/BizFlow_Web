import { prisma } from '@/shared/lib/db';
import { logger } from '@/shared/lib/logger';

export type CostingMethod = 'WAC' | 'FIFO' | 'LIFO' | 'STANDARD';

export interface CostingMetadata {
  method: CostingMethod;
  source: 'ACTIVE_LAYERS' | 'PRODUCT_FALLBACK' | 'ZERO_STOCK';
  activeLayersCount: number;
  activeLayerQty: number;
}

export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  sellingPrice: number;
  
  // Database Persisted WAC
  standardCost: number; 

  // Dynamically Computed Average Fields (Display Only)
  purchaseCost: number;    // Weighted Average base purchase cost
  additionalCost: number;  // Weighted Average landed expenses
  landedCost: number;      // Weighted Average total cost (Purchase + Additional)
  
  // Inventory Layer Metadata
  activeLayersCount: number; // Count of layers used in WAC calculation
  activeLayerQty: number;    // Sum of remainingQty of active layers
  costingMetadata: CostingMetadata;
}

export class CostingService {
  /**
   * Batch calculates the weighted average Purchase Cost, Additional Cost, and Landed Cost
   * across active inventory layers for a given list of products.
   *
   * @param products - The list of raw products from the database
   * @param businessId - The business identifier
   */
  static async computeProductAverageCosts(products: any[], businessId: string): Promise<any[]> {
    if (!products.length) return [];

    const productIds = products.map((p) => p.id);

    // Fetch active layers for the products in a single batch query
    const layers = await prisma.inventoryLayer.findMany({
      where: {
        itemId: { in: productIds },
        businessId,
        status: 'ACTIVE',
        remainingQty: { gt: 0 },
      },
    });

    // Group layers by product ID
    const layersByProductId = layers.reduce<Record<string, typeof layers>>((acc, layer) => {
      if (!acc[layer.itemId]) {
        acc[layer.itemId] = [];
      }
      acc[layer.itemId].push(layer);
      return acc;
    }, {});

    return products.map((product) => {
      const productLayers = layersByProductId[product.id] || [];

      let avgPurchase = 0;
      let avgLanded = 0;
      let avgAdditional = 0;
      let activeLayersCount = 0;
      let activeLayerQty = 0;
      let source: CostingMetadata['source'] = 'ZERO_STOCK';

      if (productLayers.length > 0) {
        activeLayersCount = productLayers.length;
        activeLayerQty = productLayers.reduce((sum, l) => sum + l.remainingQty, 0);

        if (activeLayerQty > 0) {
          source = 'ACTIVE_LAYERS';
          const totalPurchaseCostWeighted = productLayers.reduce((sum, l) => {
            const unitPurchaseCost = l.originalQty > 0 ? l.purchaseCost / l.originalQty : 0;
            return sum + unitPurchaseCost * l.remainingQty;
          }, 0);

          const totalLandedCostWeighted = productLayers.reduce((sum, l) => {
            return sum + l.unitCost * l.remainingQty;
          }, 0);

          avgPurchase = totalPurchaseCostWeighted / activeLayerQty;
          avgLanded = totalLandedCostWeighted / activeLayerQty;
          avgAdditional = avgLanded - avgPurchase;

          // Standard Cost Divergence Check (tolerance of 0.01)
          if (Math.abs(avgLanded - product.standardCost) > 0.01) {
            logger.warn('[CostingValidation] Product WAC mismatch!', {
              productId: product.id,
              computed: avgLanded,
              stored: product.standardCost,
            });
          }

          // Negative Additional Cost Warning
          if (avgAdditional < 0) {
            logger.warn('[CostingValidation] Product negative additional cost!', {
              productId: product.id,
              landed: avgLanded,
              purchase: avgPurchase,
            });
          }
        }
      }

      // Fallback Priority 2: No active layers but stock > 0
      if (source === 'ZERO_STOCK' && product.stock > 0) {
        source = 'PRODUCT_FALLBACK';
        avgPurchase = product.standardCost;
        avgLanded = product.standardCost;
        avgAdditional = 0;
        activeLayersCount = 0;
        activeLayerQty = product.stock;
      }

      // Fallback Priority 3: Stock is 0 or negative
      if (source === 'ZERO_STOCK') {
        avgPurchase = 0;
        avgLanded = 0;
        avgAdditional = 0;
        activeLayersCount = 0;
        activeLayerQty = 0;
      }

      return {
        ...product,
        purchaseCost: avgPurchase,
        additionalCost: avgAdditional,
        landedCost: avgLanded,
        activeLayersCount,
        activeLayerQty,
        costingMetadata: {
          method: 'WAC' as CostingMethod,
          source,
          activeLayersCount,
          activeLayerQty,
        },
      };
    });
  }
}
