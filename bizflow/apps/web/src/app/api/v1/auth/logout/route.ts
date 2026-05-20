/**
 * POST /api/v1/auth/logout
 *
 * Revokes the supplied refresh_token so it can never be used again.
 * Flutter must also discard its locally-stored access_token.
 * Accepts the token in the JSON body (not in Authorization header)
 * so it can be called even after the access_token has already expired.
 */

import { NextRequest } from 'next/server';
import { prisma }      from '@/lib/db';
import { ok, err }     from '@/lib/response';
import { z }           from 'zod';

const schema = z.object({ refresh_token: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return err('VALIDATION_ERROR', 'refresh_token is required', 422);
    }

    // Mark token as revoked — silently succeed even if token wasn't found
    // (idempotent logout)
    await prisma.refreshToken.updateMany({
      where: { token: parsed.data.refresh_token, revokedAt: null },
      data:  { revokedAt: new Date() },
    });

    return ok({ logged_out: true }, { message: 'Logged out successfully' });
  } catch (e) {
    console.error('[POST /api/v1/auth/logout]', e);
    return err('INTERNAL_ERROR', 'Internal Server Error', 500);
  }
}
