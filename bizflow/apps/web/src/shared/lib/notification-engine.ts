/**
 * Notification Engine — centralized notification creator.
 *
 * Used by all modules (stock, GST, CRM, AI) to create consistent,
 * categorized, prioritized notifications. Optionally sends email alerts
 * when emailNotifications is enabled.
 */

import { prisma } from '@/shared/lib/db';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationCategory = 'inventory' | 'finance' | 'gst' | 'crm' | 'general';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateNotificationParams {
  businessId: string;
  type: string;       // alert | info | success | warning
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  sourceType?: string; // sale | payment | stock | loan | gst | ai
  sourceId?: string;   // ID of the entity
  targetRole?: string; // null = all, "SUPER_ADMIN" = admins only
  userId?: string;     // null = role-broadcast, userId = specific user
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Create a notification in the database.
 * Also sends email for high/urgent priority if email notifications are enabled.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority,
        category: params.category,
        sourceType: params.sourceType ?? null,
        sourceId: params.sourceId ?? null,
        targetRole: params.targetRole ?? null,
        userId: params.userId ?? null,
        businessId: params.businessId,
      },
    });

    // For urgent/high-priority notifications, send email if enabled
    if (params.priority === 'urgent' || params.priority === 'high') {
      await sendEmailForNotification(params);
    }
  } catch (err) {
    // Notifications must never break the calling flow
    console.error('[NotificationEngine] Failed to create notification:', err);
  }
}

/**
 * Create multiple notifications in batch.
 */
export async function createNotifications(params: CreateNotificationParams[]): Promise<void> {
  try {
    await prisma.notification.createMany({
      data: params.map(p => ({
        type: p.type,
        title: p.title,
        message: p.message,
        priority: p.priority,
        category: p.category,
        sourceType: p.sourceType ?? null,
        sourceId: p.sourceId ?? null,
        targetRole: p.targetRole ?? null,
        userId: p.userId ?? null,
        businessId: p.businessId,
      })),
    });
  } catch (err) {
    console.error('[NotificationEngine] Failed to create batch notifications:', err);
  }
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(businessId: string, userRole: string, userId?: string): Promise<number> {
  return prisma.notification.count({
    where: {
      businessId,
      read: false,
      OR: [
        { targetRole: null, userId: null },   // broadcast to all
        { targetRole: userRole },              // role-targeted
        ...(userId ? [{ userId }] : []),       // user-targeted
      ],
    },
  });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllRead(businessId: string, userRole: string, userId?: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      businessId,
      read: false,
      OR: [
        { targetRole: null, userId: null },
        { targetRole: userRole },
        ...(userId ? [{ userId }] : []),
      ],
    },
    data: { read: true },
  });
  return result.count;
}

// ── Email Helper ─────────────────────────────────────────────────────────────

async function sendEmailForNotification(params: CreateNotificationParams): Promise<void> {
  try {
    // Check if email notifications are enabled
    const settings = await prisma.automationSettings.findUnique({
      where: { businessId: params.businessId },
      select: { emailNotifications: true },
    });

    if (!settings?.emailNotifications) return;

    // Get admin email
    const admin = await prisma.user.findFirst({
      where: {
        businessId: params.businessId,
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
      },
      orderBy: { role: 'asc' },
      select: { email: true },
    });

    if (!admin) return;

    // Dynamic import to avoid circular dependencies
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'BizFlow <noreply@bizflow.littleryders.com>',
      to: admin.email,
      subject: `[${params.priority.toUpperCase()}] ${params.title}`,
      text: `${params.title}\n\n${params.message}\n\n— BizFlow Notifications`,
    });
  } catch (err) {
    console.error('[NotificationEngine] Failed to send email alert:', err);
  }
}
