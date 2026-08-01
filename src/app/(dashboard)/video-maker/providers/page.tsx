import Link from "next/link";
import { Card } from "@/shared/components";
import { getProviderConnections } from "@/lib/db/providers";
import { getVideoCapabilityCatalog } from "@/lib/videoMaker/providerCapabilityCatalog";
import { listFinalRenderProviderAdapters } from "@/lib/videoMaker/finalRenderProviders";
import { VideoMakerPageHeader } from "@/features/videoMaker/ui";

export const dynamic = "force-dynamic";

function providerLabel(providerId: string): string {
  return providerId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function VideoMakerProvidersPage() {
  const connections = await getProviderConnections({}).catch(() => []);
  const safeConnections = connections.map((connection) => ({
    id: String(connection.id ?? ""),
    provider: String(connection.provider ?? ""),
    email: typeof connection.email === "string" ? connection.email : null,
    isActive: connection.isActive === true,
    testStatus: typeof connection.testStatus === "string" ? connection.testStatus : null,
    rateLimitedUntil:
      typeof connection.rateLimitedUntil === "string" ? connection.rateLimitedUntil : null,
    lastError: typeof connection.lastError === "string" ? connection.lastError : null,
  }));
  const catalog = getVideoCapabilityCatalog();
  const noAuthProviders = [...new Set(
    catalog.filter((model) => model.providerAuthType === "none").map((model) => model.providerId)
  )].sort();
  const professionalProviders = [...new Set(
    catalog.filter((model) => model.providerAuthType !== "none").map((model) => model.providerId)
  )].sort();
  const verifiedPresenterModels = catalog.filter((model) => model.verified);
  const renderAdapters = listFinalRenderProviderAdapters();

  return (
    <div className="space-y-6">
      <VideoMakerPageHeader
        title="Providers"
        description="Connect upstream provider accounts through OmniRoute. Bijoy never asks for a second OmniRoute API key and never embeds private provider credentials."
        action={
          <Link
            href="/dashboard/providers/new"
            className="inline-flex h-9 items-center rounded-control bg-accent px-4 text-sm font-medium text-white"
          >
            Connect Provider Account
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card padding="sm"><p className="text-xs text-text-muted">Connected accounts</p><p className="mt-1 text-2xl font-bold text-text-main">{safeConnections.length}</p></Card>
        <Card padding="sm"><p className="text-xs text-text-muted">Active accounts</p><p className="mt-1 text-2xl font-bold text-text-main">{safeConnections.filter((item) => item.isActive).length}</p></Card>
        <Card padding="sm"><p className="text-xs text-text-muted">Verified presenter models</p><p className="mt-1 text-2xl font-bold text-text-main">{verifiedPresenterModels.length}</p></Card>
        <Card padding="sm"><p className="text-xs text-text-muted">Final render adapters</p><p className="mt-1 text-2xl font-bold text-text-main">{renderAdapters.length}</p></Card>
      </div>

      <Card
        title="Connected Provider Accounts"
        subtitle="Only non-secret connection status is shown here. Credentials remain in OmniRoute's encrypted local store."
        action={<Link href="/dashboard/providers" className="text-sm font-medium text-accent hover:underline">Manage and test connections</Link>}
      >
        {safeConnections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-text-muted">
            No provider account is connected. Connect an upstream account or API key only where that provider requires it.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {safeConnections.map((connection) => (
              <div key={connection.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-text-main">{providerLabel(connection.provider)}</p>
                    <p className="mt-1 text-xs text-text-muted">{connection.email || "Provider credential connection"}</p>
                  </div>
                  <span className={connection.isActive ? "text-xs font-semibold text-emerald-600" : "text-xs font-semibold text-text-muted"}>
                    {connection.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  Test: {connection.testStatus || "Not tested"}
                  {connection.rateLimitedUntil ? ` · Rate limited until ${connection.rateLimitedUntil}` : ""}
                </p>
                {connection.lastError && <p className="mt-2 text-xs text-red-600">{connection.lastError}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Automatic Free Providers" subtitle="No-auth registry providers; availability, quotas and quality remain provider-defined.">
          {noAuthProviders.length ? (
            <div className="flex flex-wrap gap-2">
              {noAuthProviders.map((provider) => <span key={provider} className="rounded-full border border-border px-3 py-1 text-xs text-text-muted">{providerLabel(provider)}</span>)}
            </div>
          ) : <p className="text-sm text-text-muted">No hosted no-auth video provider is currently registered.</p>}
          <p className="mt-4 text-xs leading-5 text-amber-600">
            Free does not mean unlimited. Quotas, availability and terms can change upstream.
          </p>
        </Card>

        <Card title="Professional Video Providers" subtitle="A model is blocked until all selected presenter requirements are source-verified and contract-tested.">
          <p className="text-sm text-text-muted">{professionalProviders.length} hosted provider families appear in the video registry.</p>
          <p className="mt-3 text-sm text-text-muted">
            Current fully verified default presenter models: <strong className="text-text-main">{verifiedPresenterModels.length}</strong>. This conservative value prevents false claims about Bangla voice, lip-sync, exact 10 seconds or 1080p.
          </p>
          <Link href="/api/video-maker/provider-capabilities" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">View capability evidence JSON</Link>
        </Card>
      </div>

      <Card title="Final Render Provider" subtitle="Cloud composition only; local FFmpeg is not used.">
        {renderAdapters.length ? (
          <div className="flex flex-wrap gap-2">{renderAdapters.map((adapter) => <span key={adapter.providerId} className="rounded-full border border-border px-3 py-1 text-xs text-text-muted">{adapter.displayName}</span>)}</div>
        ) : (
          <p className="text-sm text-text-muted">Render provider not configured. A verified API adapter must be added before 33 completed scenes can be composed.</p>
        )}
      </Card>
    </div>
  );
}
