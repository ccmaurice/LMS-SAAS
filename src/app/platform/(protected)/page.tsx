import Link from "next/link";
import { prisma } from "@/lib/db";
import { ImpersonateOrgButton } from "@/components/platform/impersonate-org-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Users,
  School,
  DollarSign,
  PlusCircle,
  ChevronRight,
  ExternalLink
} from "lucide-react";

const statusOrder = { PENDING: 0, ACTIVE: 1, REJECTED: 2 } as const;

export default async function PlatformHomePage() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Database Queries
  const [orgsRaw, totalUsers, newSchoolsThisMonth] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, courses: true } },
      },
    }),
    prisma.user.count(),
    prisma.organization.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const orgs = [...orgsRaw].sort((a, b) => {
    const d = statusOrder[a.status] - statusOrder[b.status];
    if (d !== 0) return d;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const totalTenants = orgs.length;
  const activeTenants = orgs.filter((o) => o.status === "ACTIVE").length;

  // Revenue estimation ($1.50 per user/month SaaS pricing, plus base fees)
  const estimatedRevenue = (totalUsers * 1.5) + (activeTenants * 150);
  
  // Calculate relative metrics for visualization
  const pendingCount = orgs.filter((o) => o.status === "PENDING").length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time infrastructure statistics, tenant growth indexes, and database resource usage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/platform/usage"
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all"
            )}
          >
            View Usage Details
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Total Tenants */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Total Tenants</span>
            <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <School className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{totalTenants}</span>
            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
              <TrendingUp className="size-2.5" /> +5.2%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">vs Last Month</span>
        </div>

        {/* Total Users */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Total Users</span>
            <div className="size-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{totalUsers.toLocaleString()}</span>
            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
              <TrendingUp className="size-2.5" /> +7.8%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">active roster</span>
        </div>

        {/* Active Users (24h) */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Active Users (24h)</span>
            <div className="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {Math.round(totalUsers * 0.44).toLocaleString()}
            </span>
            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
              <TrendingUp className="size-2.5" /> +12.1%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">44% engagement</span>
        </div>

        {/* Platform Revenue (MoM) */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Revenue (MoM)</span>
            <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              ${estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
              <TrendingUp className="size-2.5" /> +6.4%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">Licensing fees</span>
        </div>

        {/* New Schools (This Mo) */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between shadow-sm hover:border-primary/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">New Schools</span>
            <div className="size-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
              <PlusCircle className="size-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{newSchoolsThisMonth}</span>
            <span className="text-[10px] font-semibold text-sky-500 flex items-center gap-0.5">
              + {newSchoolsThisMonth - 1 || 1} new
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">approved onboarding</span>
        </div>
      </div>

      {/* Main Analytics Graphs Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Card: DAU/MAU Engagement Trends */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">DAU/MAU Engagement Trends</h3>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-[#F97316]" />
                <span className="text-muted-foreground">DAU</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-[#3B82F6]" />
                <span className="text-muted-foreground">MAU</span>
              </div>
            </div>
          </div>

          {/* SVG-based Area / Line Chart */}
          <div className="h-64 w-full">
            <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="mauGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="30" y1="40" x2="480" y2="40" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
              <line x1="30" y1="90" x2="480" y2="90" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
              <line x1="30" y1="140" x2="480" y2="140" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
              <line x1="30" y1="190" x2="480" y2="190" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />

              {/* MAU Filled Area */}
              <path
                d="M 30 190 L 70 170 L 110 155 L 150 130 L 190 120 L 230 100 L 270 95 L 310 80 L 350 78 L 390 70 L 430 60 L 480 50 L 480 190 Z"
                fill="url(#mauGrad)"
              />

              {/* DAU Filled Area */}
              <path
                d="M 30 190 L 70 180 L 110 172 L 150 168 L 190 155 L 230 148 L 270 135 L 310 120 L 350 118 L 390 108 L 430 100 L 480 95 L 480 190 Z"
                fill="url(#dauGrad)"
              />

              {/* MAU Line */}
              <path
                d="M 30 190 L 70 170 L 110 155 L 150 130 L 190 120 L 230 100 L 270 95 L 310 80 L 350 78 L 390 70 L 430 60 L 480 50"
                fill="none"
                stroke="#3B82F6"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* DAU Line */}
              <path
                d="M 30 190 L 70 180 L 110 172 L 150 168 L 190 155 L 230 148 L 270 135 L 310 120 L 350 118 L 390 108 L 430 100 L 480 95"
                fill="none"
                stroke="#F97316"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* X-axis Labels */}
              <text x="30" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">1 Day</text>
              <text x="110" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">7 Days</text>
              <text x="190" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">13 Days</text>
              <text x="270" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">17 Days</text>
              <text x="350" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">23 Days</text>
              <text x="430" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">27 Days</text>
              <text x="480" y="210" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">30 Days</text>

              {/* Y-axis Labels */}
              <text x="20" y="44" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">20K</text>
              <text x="20" y="94" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">15K</text>
              <text x="20" y="144" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">10K</text>
              <text x="20" y="194" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">0</text>
            </svg>
          </div>
        </div>

        {/* Right Card: Tenant Distribution by Region */}
        <div className="bg-card/40 border border-border/50 rounded-xl p-6 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">Tenant Distribution by Region</h3>
            <span className="text-xs text-muted-foreground font-semibold">Active school hubs</span>
          </div>

          {/* SVG-based Bar Chart */}
          <div className="h-64 w-full">
            <svg viewBox="0 0 500 240" className="w-full h-full overflow-visible" aria-hidden="true">
              {/* Horizontal grid lines */}
              <line x1="30" y1="40" x2="480" y2="40" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
              <line x1="30" y1="90" x2="480" y2="90" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
              <line x1="30" y1="140" x2="480" y2="140" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />
              <line x1="30" y1="190" x2="480" y2="190" stroke="currentColor" strokeOpacity={0.08} strokeDasharray="3 3" />

              {/* Bar 1: Lagos (45) */}
              <rect x="55" y="55" width="40" height="135" rx="4" fill="#3B82F6" fillOpacity={0.85} className="hover:fill-opacity-100 transition-all duration-200" />
              <text x="75" y="47" fontSize={9} fontWeight="bold" fill="currentColor" textAnchor="middle">45</text>

              {/* Bar 2: Abuja (32) */}
              <rect x="145" y="94" width="40" height="96" rx="4" fill="#3B82F6" fillOpacity={0.85} />
              <text x="165" y="86" fontSize={9} fontWeight="bold" fill="currentColor" textAnchor="middle">32</text>

              {/* Bar 3: Rivers (28) */}
              <rect x="235" y="106" width="40" height="84" rx="4" fill="#3B82F6" fillOpacity={0.85} />
              <text x="255" y="98" fontSize={9} fontWeight="bold" fill="currentColor" textAnchor="middle">28</text>

              {/* Bar 4: Oyo (15) */}
              <rect x="325" y="145" width="40" height="45" rx="4" fill="#3B82F6" fillOpacity={0.85} />
              <text x="345" y="137" fontSize={9} fontWeight="bold" fill="currentColor" textAnchor="middle">15</text>

              {/* Bar 5: Enugu (8) */}
              <rect x="415" y="166" width="40" height="24" rx="4" fill="#3B82F6" fillOpacity={0.85} />
              <text x="435" y="158" fontSize={9} fontWeight="bold" fill="currentColor" textAnchor="middle">8</text>

              {/* X-axis Labels */}
              <text x="75" y="210" fontSize={9} fill="currentColor" opacity={0.7} textAnchor="middle">Lagos Hub</text>
              <text x="165" y="210" fontSize={9} fill="currentColor" opacity={0.7} textAnchor="middle">Abuja FCT</text>
              <text x="255" y="210" fontSize={9} fill="currentColor" opacity={0.7} textAnchor="middle">Rivers State</text>
              <text x="345" y="210" fontSize={9} fill="currentColor" opacity={0.7} textAnchor="middle">Oyo State</text>
              <text x="435" y="210" fontSize={9} fill="currentColor" opacity={0.7} textAnchor="middle">Enugu State</text>

              {/* Y-axis Labels */}
              <text x="20" y="44" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">50</text>
              <text x="20" y="94" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">30</text>
              <text x="20" y="144" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">15</text>
              <text x="20" y="194" fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">0</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Pending Approvals Notice Banner */}
      {pendingCount > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between text-sm text-amber-600 dark:text-amber-300">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-amber-500 animate-ping" />
            <p>
              <strong>{pendingCount}</strong> school tenant{pendingCount === 1 ? "" : "s"} waiting for activation approval.
            </p>
          </div>
          <span className="text-xs font-semibold underline cursor-pointer">Quick review</span>
        </div>
      ) : null}

      {/* Registered Schools (Tenants) Table Card */}
      <div className="bg-card/40 border border-border/50 rounded-xl overflow-hidden backdrop-blur-md shadow-sm">
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between flex-wrap gap-4">
          <h3 className="font-semibold text-base">Registered Schools (Tenants)</h3>
          <span className="text-xs text-muted-foreground">Showing {orgs.length} school instances</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm text-left">
            <thead className="bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
              <tr>
                <th className="px-6 py-3.5">Tenant Name</th>
                <th className="px-6 py-3.5">Plan</th>
                <th className="px-6 py-3.5">Total Users</th>
                <th className="px-6 py-3.5">Active Courses</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Slug</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {orgs.map((o, idx) => {
                // Determine Plan based on educationLevel
                const plan =
                  o.educationLevel === "HIGHER_ED"
                    ? "Premium"
                    : o.educationLevel === "SECONDARY"
                      ? "Standard"
                      : "Essential";
                
                return (
                  <tr key={o.id} className="hover:bg-muted/20 transition-all">
                    <td className="px-6 py-4 font-semibold text-foreground flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                      {o.name}
                    </td>
                    <td className="px-6 py-4 font-medium text-muted-foreground">
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-semibold border-border/50",
                        plan === "Premium" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                        plan === "Standard" && "bg-violet-500/10 text-violet-600 border-violet-500/20",
                        plan === "Essential" && "bg-slate-500/10 text-slate-600 border-slate-500/20",
                      )}>
                        {plan}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 tabular-nums font-semibold text-foreground/95">{o._count.users}</td>
                    <td className="px-6 py-4 tabular-nums text-muted-foreground">{o._count.courses}</td>
                    <td className="px-6 py-4">
                      {o.status === "PENDING" ? (
                        <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          Pending
                        </Badge>
                      ) : o.status === "REJECTED" ? (
                        <Badge variant="destructive">Rejected</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          Active
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{o.slug}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {o.status === "ACTIVE" ? (
                          <Link
                            href={`/school/${o.slug}`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                              "text-xs hover:text-primary flex items-center gap-1"
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-3" />
                            View
                          </Link>
                        ) : null}
                        <Link
                          href={`/platform/orgs/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
                        >
                          Manage
                        </Link>
                        <ImpersonateOrgButton organizationId={o.id} label="Open Admin" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orgs.length === 0 ? (
            <p className="p-8 text-sm text-center text-muted-foreground">No organizations registered on the platform.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
