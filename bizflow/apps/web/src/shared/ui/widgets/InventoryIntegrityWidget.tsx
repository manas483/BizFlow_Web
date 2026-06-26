"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { useInventoryHealth } from "@/shared/hooks/useInventoryHealth";
import { AlertTriangle, CheckCircle, Server, Activity, AlertOctagon } from "lucide-react";
import { formatDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/ui/Badge";

export function InventoryIntegrityWidget() {
  const { metrics, isLoading, isError } = useInventoryHealth();

  if (isLoading) {
    return (
      <Card className="col-span-1 border border-border/50 shadow-sm animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Integrity Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted/20 rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !metrics) {
    return (
      <Card className="col-span-1 border border-red-500/20 shadow-sm bg-red-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Inventory Integrity Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-500/80">Failed to load health metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const isHealthy = metrics.driftProducts === 0 && metrics.negativeLayers === 0 && metrics.orphanConsumptions === 0;

  return (
    <Card className={`col-span-full xl:col-span-1 border shadow-sm transition-colors duration-300 ${isHealthy ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {isHealthy ? <CheckCircle className="h-4 w-4" /> : <AlertOctagon className="h-4 w-4" />}
          Inventory Integrity Health
        </CardTitle>
        <Badge variant={isHealthy ? 'default' : 'danger'} className={isHealthy ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''}>
          {isHealthy ? 'System Optimal' : 'Action Required'}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
          
          {/* Layer Counts */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Server className="h-3 w-3" /> Total Layers
            </span>
            <span className="text-lg font-bold">{metrics.totalLayers.toLocaleString()}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Activity className="h-3 w-3 text-blue-500" /> Active Layers
            </span>
            <span className="text-lg font-bold">{metrics.activeLayers.toLocaleString()}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Exhausted</span>
            <span className="text-lg font-bold text-muted-foreground">{metrics.exhaustedLayers.toLocaleString()}</span>
          </div>

          {/* Drift & Errors */}
          <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
            <span className={`text-xs flex items-center gap-1 ${metrics.driftProducts > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              <AlertTriangle className="h-3 w-3" /> Drift Products
            </span>
            <span className={`text-lg font-bold ${metrics.driftProducts > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {metrics.driftProducts}
            </span>
          </div>

          <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
            <span className={`text-xs ${metrics.negativeLayers > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              Negative Layers
            </span>
            <span className={`text-lg font-bold ${metrics.negativeLayers > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {metrics.negativeLayers}
            </span>
          </div>

          <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
            <span className={`text-xs ${metrics.orphanConsumptions > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              Orphans
            </span>
            <span className={`text-lg font-bold ${metrics.orphanConsumptions > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
              {metrics.orphanConsumptions}
            </span>
          </div>

        </div>

        <div className="mt-4 pt-2 border-t border-border/20 flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">Last Validated:</span>
          <span className="text-[10px] text-muted-foreground font-mono">{formatDate(new Date(metrics.lastValidationTime))}</span>
        </div>
      </CardContent>
    </Card>
  );
}
