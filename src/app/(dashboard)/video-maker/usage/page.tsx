import UsageView from "@/features/videoMaker/UsageView";
import { getVideoMakerDashboardStats } from "@/lib/db/videoProjects";
export const dynamic = "force-dynamic";
export default function UsagePage() { return <UsageView stats={getVideoMakerDashboardStats()} />; }
