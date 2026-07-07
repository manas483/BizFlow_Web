import { BackupManifestType } from '../types';

export const backupManifest: BackupManifestType = {
  version: "1.0",
  models: [
    {
      modelName: "Business",
      tableName: "Business",
      businessIdField: "id",
      isTenantOwned: true,
      order: 1
    },
    {
      modelName: "User",
      tableName: "User",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 2
    },
    {
      modelName: "Invitation",
      tableName: "Invitation",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 3
    },
    {
      modelName: "Supplier",
      tableName: "Supplier",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 4
    },
    {
      modelName: "Product",
      tableName: "Product",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 5
    },
    {
      modelName: "Customer",
      tableName: "Customer",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 6
    },
    {
      modelName: "Sale",
      tableName: "Sale",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 7
    },
    {
      modelName: "SaleItem",
      tableName: "SaleItem",
      businessIdField: "sale.businessId",
      isTenantOwned: true,
      order: 8
    },
    {
      modelName: "SalePayment",
      tableName: "SalePayment",
      businessIdField: "sale.businessId",
      isTenantOwned: true,
      order: 9
    },
    {
      modelName: "CreditNote",
      tableName: "CreditNote",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 10
    },
    {
      modelName: "DebitNote",
      tableName: "DebitNote",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 11
    },
    {
      modelName: "BillOfSupply",
      tableName: "BillOfSupply",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 12
    },
    {
      modelName: "BillOfSupplyItem",
      tableName: "BillOfSupplyItem",
      businessIdField: "billOfSupply.businessId",
      isTenantOwned: true,
      order: 13
    },
    {
      modelName: "Quotation",
      tableName: "Quotation",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 14
    },
    {
      modelName: "QuotationItem",
      tableName: "QuotationItem",
      businessIdField: "quotation.businessId",
      isTenantOwned: true,
      order: 15
    },
    {
      modelName: "Expense",
      tableName: "Expense",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 16
    },
    {
      modelName: "Employee",
      tableName: "Employee",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 17
    },
    {
      modelName: "AttendanceRecord",
      tableName: "AttendanceRecord",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 18
    },
    {
      modelName: "LeaveRequest",
      tableName: "LeaveRequest",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 19
    },
    {
      modelName: "AttendanceTicket",
      tableName: "AttendanceTicket",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 20
    },
    {
      modelName: "Notification",
      tableName: "Notification",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 21
    },
    {
      modelName: "UserActivity",
      tableName: "UserActivity",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 22
    },
    {
      modelName: "RefreshToken",
      tableName: "RefreshToken",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 23
    },
    {
      modelName: "DeviceToken",
      tableName: "DeviceToken",
      businessIdField: "user.businessId",
      isTenantOwned: true,
      order: 24
    },
    {
      modelName: "Account",
      tableName: "Account",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 25
    },
    {
      modelName: "JournalEntry",
      tableName: "JournalEntry",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 26
    },
    {
      modelName: "JournalLine",
      tableName: "JournalLine",
      businessIdField: "journalEntry.businessId",
      isTenantOwned: true,
      order: 27
    },
    {
      modelName: "AccountsReceivable",
      tableName: "AccountsReceivable",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 28
    },
    {
      modelName: "AccountsPayable",
      tableName: "AccountsPayable",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 29
    },
    {
      modelName: "CashBookEntry",
      tableName: "CashBookEntry",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 30
    },
    {
      modelName: "BankAccount",
      tableName: "BankAccount",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 31
    },
    {
      modelName: "BankBookEntry",
      tableName: "BankBookEntry",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 32
    },
    {
      modelName: "BankReconciliation",
      tableName: "BankReconciliation",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 33
    },
    {
      modelName: "GstReturn",
      tableName: "GstReturn",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 34
    },
    {
      modelName: "TdsEntry",
      tableName: "TdsEntry",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 35
    },
    {
      modelName: "LoanMaster",
      tableName: "LoanMaster",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 36
    },
    {
      modelName: "LoanSchedule",
      tableName: "LoanSchedule",
      businessIdField: "loan.businessId",
      isTenantOwned: true,
      order: 37
    },
    {
      modelName: "LoanPayment",
      tableName: "LoanPayment",
      businessIdField: "loan.businessId",
      isTenantOwned: true,
      order: 38
    },
    {
      modelName: "LoanDocument",
      tableName: "LoanDocument",
      businessIdField: "loan.businessId",
      isTenantOwned: true,
      order: 39
    },
    {
      modelName: "CustomRole",
      tableName: "CustomRole",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 40
    },
    {
      modelName: "AuditLog",
      tableName: "AuditLog",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 41
    },
    {
      modelName: "BackupRecord",
      tableName: "BackupRecord",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 42
    },
    {
      modelName: "AutomationSettings",
      tableName: "AutomationSettings",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 43
    },
    {
      modelName: "Warehouse",
      tableName: "Warehouse",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 44
    },
    {
      modelName: "AiForecast",
      tableName: "AiForecast",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 45
    },
    {
      modelName: "StockMovement",
      tableName: "StockMovement",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 46
    },
    {
      modelName: "Purchase",
      tableName: "Purchase",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 47
    },
    {
      modelName: "InventoryLayer",
      tableName: "InventoryLayer",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 48
    },
    {
      modelName: "InventoryLayerCost",
      tableName: "InventoryLayerCost",
      businessIdField: "layer.businessId",
      isTenantOwned: true,
      order: 49
    },
    {
      modelName: "ExpenseAllocationHistory",
      tableName: "ExpenseAllocationHistory",
      businessIdField: "expense.businessId",
      isTenantOwned: true,
      order: 50
    },
    {
      modelName: "InventoryLayerConsumption",
      tableName: "InventoryLayerConsumption",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 51
    },
    {
      modelName: "InventorySerial",
      tableName: "InventorySerial",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 52
    },
    {
      modelName: "InventoryRevaluation",
      tableName: "InventoryRevaluation",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 53
    },
    {
      modelName: "InventoryCostAdjustment",
      tableName: "InventoryCostAdjustment",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 54
    },
    {
      modelName: "InventoryPeriodClosing",
      tableName: "InventoryPeriodClosing",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 55
    },
    {
      modelName: "StockCount",
      tableName: "StockCount",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 56
    },
    {
      modelName: "StockCountItem",
      tableName: "StockCountItem",
      businessIdField: "stockCount.businessId",
      isTenantOwned: true,
      order: 57
    },
    {
      modelName: "BillOfMaterial",
      tableName: "BillOfMaterial",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 58
    },
    {
      modelName: "BillOfMaterialItem",
      tableName: "BillOfMaterialItem",
      businessIdField: "bom.businessId",
      isTenantOwned: true,
      order: 59
    },
    {
      modelName: "InvoiceTemplate",
      tableName: "InvoiceTemplate",
      businessIdField: "businessId",
      isTenantOwned: true,
      order: 60
    },
    {
      modelName: "PurchaseItem",
      tableName: "PurchaseItem",
      businessIdField: "purchase.businessId",
      isTenantOwned: true,
      order: 61
    },
    {
      modelName: "PurchaseAttachment",
      tableName: "PurchaseAttachment",
      businessIdField: "purchase.businessId",
      isTenantOwned: true,
      order: 62
    }
  ]
};
