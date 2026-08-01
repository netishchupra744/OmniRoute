import DashboardView from "@/features/videoMaker/DashboardView";
import { getVideoMakerDashboardStats } from "@/lib/db/videoProjects";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <DashboardView stats={getVideoMakerDashboardStats()} />;
}
