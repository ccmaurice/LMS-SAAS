import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyCompletionCertificatePublic } from "@/lib/certificates/completion-certificate";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { name: true },
  });
  if (!org) return { title: "Verify certificate" };
  return {
    title: `Verify certificate — ${org.name}`,
    description: `Confirm a course completion certificate was issued by ${org.name}.`,
  };
}

export default async function VerifyCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawId = typeof sp.id === "string" ? sp.id : "";

  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { name: true },
  });
  if (!org) notFound();

  const result = rawId.trim() ? await verifyCompletionCertificatePublic(slug, rawId) : null;

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {org.name}
      </p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-foreground">
        Certificate verification
      </h1>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Enter the credential ID printed on the certificate, or scan the QR code on the document.
      </p>

      <form
        action={`/school/${encodeURIComponent(slug)}/verify-certificate`}
        method="get"
        className="mt-8 flex flex-col gap-3"
      >
        <label className="text-sm font-medium text-foreground" htmlFor="credential-id">
          Credential ID
        </label>
        <input
          id="credential-id"
          name="id"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. clx…"
          defaultValue={rawId}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2"
        />
        <button type="submit" className={cn(buttonVariants(), "w-full justify-center")}>
          Verify
        </button>
      </form>

      {result != null ? (
        <div
          className={cn(
            "mt-10 rounded-xl border p-6 text-center",
            result.ok
              ? "border-emerald-500/35 bg-emerald-500/5 dark:border-emerald-400/30 dark:bg-emerald-500/10"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          {result.ok ? (
            <>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Authentic certificate</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This credential is on record as issued by <strong className="text-foreground">{result.schoolName}</strong>
                .
              </p>
              <dl className="mt-4 space-y-2 text-left text-sm">
                <div className="flex flex-col gap-0.5 border-t border-border/60 pt-3 dark:border-white/10">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Course</dt>
                  <dd className="text-foreground">{result.courseTitle}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipient</dt>
                  <dd className="text-foreground">{result.recipientDisplayName}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issued</dt>
                  <dd className="text-foreground">
                    {result.issuedAt.toLocaleDateString(undefined, { dateStyle: "long" })}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-destructive">Not verified</p>
              <p className="mt-2 text-sm text-muted-foreground">
                No matching certificate was found for this school. Check the credential ID, or contact the school if you
                believe this is an error.
              </p>
            </>
          )}
        </div>
      ) : null}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <Link href={`/school/${encodeURIComponent(slug)}`} className="underline-offset-4 hover:underline">
          ← Back to school page
        </Link>
      </p>
    </div>
  );
}
