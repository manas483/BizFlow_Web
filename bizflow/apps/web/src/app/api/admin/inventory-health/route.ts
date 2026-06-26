export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

function round4(num: number) {
  return Math.round(num * 10000) / 10000;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    const [totalLayers, activeLayers, exhaustedLayers, negativeLayers, consumptions, layerIdsObj, products] = await Promise.all([
      prisma.inventoryLayer.count({ where: { businessId } }),
      prisma.inventoryLayer.count({ where: { businessId, status: 'ACTIVE' } }),
      prisma.inventoryLayer.count({ where: { businessId, status: 'EXHAUSTED' } }),
      prisma.inventoryLayer.count({ where: { businessId, remainingQty: { lt: 0 } } }),
      prisma.inventoryLayerConsumption.findMany({
        where: { businessId },
        select: { id: true, layerId: true }
      }),
      prisma.inventoryLayer.findMany({ where: { businessId }, select: { id: true } }),
      prisma.product.findMany({
        where: { businessId },
        select: { id: true, stock: true, standardCost: true }
      })
    ]);

    // Check for orphans
    const layerIds = new Set(layerIdsObj.map((l: any) => l.id));
    let orphanConsumptions = 0;
    for (const c of consumptions) {
      if (!layerIds.has(c.layerId)) {
        orphanConsumptions++;
      }
    }

    // Check for drift
    let driftProducts = 0;
    
    // We need layer counts per product to calculate WAC and Stock correctly.
    const activeLayersList = await prisma.inventoryLayer.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: { itemId: true, remainingQty: true, unitCost: true }
    });

    const layersByProduct = activeLayersList.reduce((acc: any, layer: any) => {
      if (!acc[layer.itemId]) acc[layer.itemId] = { qty: 0, val: 0 };
      acc[layer.itemId].qty += layer.remainingQty;
      acc[layer.itemId].val += (layer.remainingQty * layer.unitCost);
      return acc;
    }, {});

    for (const p of products) {
      const layerSum = layersByProduct[p.id] ? layersByProduct[p.id].qty : 0;
      const layerVal = layersByProduct[p.id] ? layersByProduct[p.id].val : 0;
      const wac = layerSum > 0 ? layerVal / layerSum : 0;

      const stockDrift = Math.abs(p.stock - layerSum) > 0.001;
      const wacDrift = Math.abs(p.standardCost - round4(wac)) > 0.001;

      if (stockDrift || wacDrift) {
        driftProducts++;
      }
    }

    return NextResponse.json({
      data: {
        totalLayers,
        activeLayers,
        exhaustedLayers,
        negativeLayers,
        orphanConsumptions,
        driftProducts,
        lastValidationTime: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('[Inventory Health API] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
