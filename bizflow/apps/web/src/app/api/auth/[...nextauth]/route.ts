import { handlers } from "@/shared/lib/auth";
import { withPerf } from "@/shared/lib/telemetry";

export const GET = withPerf(handlers.GET);
export const POST = withPerf(handlers.POST);
