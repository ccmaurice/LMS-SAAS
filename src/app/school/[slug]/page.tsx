import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getOrganizationLogoUrl } from "@/lib/org/org-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { toAbsoluteMetadataUrl } from "@/lib/seo/to-absolute-metadata-url";
import { HERO_BRAND_LOGO_IMG_CLASSES } from "@/lib/ui/brand-logo-classes";
import {
  aboutBodyFromCms,
  parseGalleryUrls,
  parseSchoolPublicExtraCards,
  resolveAboutVideoSource,
  resolveHeroImageSrc,
  resolvePublicCardImageSrc,
  resolvePublicCardVideoSource,
  SCHOOL_PUBLIC_EXTRA_CARDS_KEY,
  type SchoolPublicCmsMap,
} from "@/lib/school-public";

/** Max custom-section links in the hero (remaining sections: “+N more” → anchor below). */
const HERO_CUSTOM_NAV_MAX = 6;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true, name: true, slug: true, heroImageUrl: true, logoImageUrl: true },
  });
  if (!org) return {};
  const logoUrl = await getOrganizationLogoUrl(org.id, org.slug, org.logoImageUrl, org.heroImageUrl);
  if (!logoUrl) {
    return { title: org.name, description: `Public page for ${org.name}` };
  }
  const abs = toAbsoluteMetadataUrl(logoUrl);
  return {
    title: org.name,
    description: `Public page for ${org.name}`,
    icons: {
      icon: [{ url: abs, rel: "icon" }],
      shortcut: [{ url: abs }],
      apple: [{ url: abs }],
    },
  };
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/60 py-16 dark:border-white/10">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function Prose({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n\n+/).filter(Boolean);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {p}
        </p>
      ))}
    </div>
  );
}

function AboutVideoBlock({
  slug,
  orgId,
  raw,
}: {
  slug: string;
  orgId: string;
  raw: string;
}) {
  const source = resolveAboutVideoSource({ slug, orgId, raw });
  if (!source) return null;
  if (source.kind === "youtube") {
    return (
      <div className="mt-8 aspect-video overflow-hidden rounded-xl border border-border/60 dark:border-white/10">
        <iframe
          title="School video"
          src={source.embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <video
      className="mt-8 w-full overflow-hidden rounded-xl border border-border/60 dark:border-white/10"
      controls
      preload="metadata"
      src={source.src}
    />
  );
}

function ExtraCardVideoBlock({ slug, orgId, raw }: { slug: string; orgId: string; raw: string }) {
  const source = resolvePublicCardVideoSource({ slug, orgId, raw });
  if (!source) return null;
  if (source.kind === "youtube") {
    return (
      <div className="mt-8 aspect-video overflow-hidden rounded-xl border border-border/60 dark:border-white/10">
        <iframe
          title="Section video"
          src={source.embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <video
      className="mt-8 w-full overflow-hidden rounded-xl border border-border/60 dark:border-white/10"
      controls
      preload="metadata"
      src={source.src}
    />
  );
}

export default async function SchoolPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      heroImageUrl: true,
      logoImageUrl: true,
    },
  });

  if (!org) notFound();

  const cmsRows = await prisma.cmsEntry.findMany({
    where: { organizationId: org.id, key: { startsWith: "school.public." } },
    select: { key: true, value: true },
  });

  const cms = Object.fromEntries(cmsRows.map((r) => [r.key, r.value])) as SchoolPublicCmsMap;

  const brandMarkUrl = await getOrganizationLogoUrl(org.id, org.slug, org.logoImageUrl, org.heroImageUrl, {
    cmsHeroImageUrl: cms["school.public.hero.imageUrl"],
  });

  const heroTitle = cms["school.public.hero.title"]?.trim() || org.name;
  const heroSubtitle = cms["school.public.hero.subtitle"]?.trim() || "";
  const ctaText = cms["school.public.hero.ctaText"]?.trim() || "Member sign in";
  const ctaHref = cms["school.public.hero.ctaHref"]?.trim() || `/login?org=${encodeURIComponent(org.slug)}`;
  const ctaExternal = /^https?:\/\//i.test(ctaHref);
  const heroImg = resolveHeroImageSrc({
    slug: org.slug,
    orgId: org.id,
    orgHeroImageUrl: org.heroImageUrl,
    cmsHeroImageUrl: cms["school.public.hero.imageUrl"],
  });

  /** Prefer dedicated brand logo; otherwise same image as hero (matches header branding when no logo file). */
  const heroTopLogoSrc = brandMarkUrl;

  const admissions = cms["school.public.admissions"]?.trim() ?? "";
  const about = aboutBodyFromCms(cms);
  const aboutVideoRaw = cms["school.public.about.videoUrl"]?.trim() ?? "";
  const contact = cms["school.public.contact"]?.trim() ?? "";
  const gallery = parseGalleryUrls(cms["school.public.gallery"]);
  const extraCards = parseSchoolPublicExtraCards(cms[SCHOOL_PUBLIC_EXTRA_CARDS_KEY]);

  return (
    <div className="relative">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-background/70 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            ← Platform home
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {ctaExternal ? (
              <a href={ctaHref} className={cn(buttonVariants({ size: "sm" }))}>
                {ctaText}
              </a>
            ) : (
              <Link href={ctaHref} className={cn(buttonVariants({ size: "sm" }))}>
                {ctaText}
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="relative min-h-[min(70vh,560px)] w-full overflow-hidden">
          {heroImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" aria-hidden />
          ) : (
            <div
              className="absolute inset-0 z-0 bg-gradient-to-br from-primary/30 via-muted to-accent/25"
              aria-hidden
            />
          )}
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-background via-background/70 to-background/30" />
          <div className="relative z-10 mx-auto flex min-h-[min(70vh,560px)] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center md:px-8 md:py-24">
            {heroTopLogoSrc ? (
              <div className="mb-6 flex w-full shrink-0 justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroTopLogoSrc}
                  alt=""
                  className={HERO_BRAND_LOGO_IMG_CLASSES}
                />
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Welcome</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tighter md:text-5xl">{heroTitle}</h1>
            {heroSubtitle ? (
              <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                {heroSubtitle}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#admissions" className={cn(buttonVariants({ size: "lg" }))}>
                Admissions
              </a>
              <a href="#about-us" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
                About us
              </a>
              <a href="#gallery" className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}>
                Gallery
              </a>
              <a href="#contact" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>
                Contact
              </a>
              {extraCards.slice(0, HERO_CUSTOM_NAV_MAX).map((c) => (
                <a
                  key={c.id}
                  href={`#section-${c.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  {c.title}
                </a>
              ))}
              {extraCards.length > HERO_CUSTOM_NAV_MAX ? (
                <a
                  href="#custom-sections-start"
                  className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
                >
                  +{extraCards.length - HERO_CUSTOM_NAV_MAX} more
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {admissions ? (
        <Section id="admissions" title="Admissions">
          <Prose text={admissions} />
        </Section>
      ) : (
        <Section id="admissions" title="Admissions">
          <p className="text-sm text-muted-foreground">
            Content coming soon. School admins can add this text in <strong className="text-foreground">Admin → CMS</strong>{" "}
            under the public school page fields.
          </p>
        </Section>
      )}

      {about || aboutVideoRaw ? (
        <Section id="about-us" title="About us">
          {about ? <Prose text={about} /> : null}
          {aboutVideoRaw ? <AboutVideoBlock slug={org.slug} orgId={org.id} raw={aboutVideoRaw} /> : null}
        </Section>
      ) : (
        <Section id="about-us" title="About us">
          <p className="text-sm text-muted-foreground">
            Tell your story here — mission, leadership, and campus life. Admins edit this in{" "}
            <strong className="text-foreground">Admin → CMS</strong> (About us + optional YouTube or uploaded video).
          </p>
        </Section>
      )}

      <Section id="gallery" title="Gallery">
        {gallery.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {gallery.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="overflow-hidden rounded-xl border border-border/60 bg-muted/30 dark:border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add image URLs (one per line) in CMS under <code className="rounded bg-muted px-1">school.public.gallery</code>.
          </p>
        )}
      </Section>

      {contact ? (
        <Section id="contact" title="Contact">
          <Prose text={contact} />
        </Section>
      ) : (
        <Section id="contact" title="Contact">
          <p className="text-sm text-muted-foreground">Contact information can be added in the CMS.</p>
        </Section>
      )}

      {extraCards.length > 0 ? <div id="custom-sections-start" className="scroll-mt-24" /> : null}
      {extraCards.map((card) => {
        const img = resolvePublicCardImageSrc({
          slug: org.slug,
          orgId: org.id,
          raw: card.imageUrl,
        });
        return (
          <Section id={`section-${card.id}`} key={card.id} title={card.title}>
            {card.body.trim() ? <Prose text={card.body} /> : null}
            {img ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-muted/20 dark:border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="max-h-[28rem] w-full object-contain" loading="lazy" />
              </div>
            ) : null}
            <ExtraCardVideoBlock slug={org.slug} orgId={org.id} raw={card.videoUrl} />
          </Section>
        );
      })}

      <footer className="border-t border-border/60 py-10 text-center text-xs text-muted-foreground dark:border-white/10">
        <p>
          © {new Date().getFullYear()} {org.name}.{" "}
          <Link href={`/login?org=${encodeURIComponent(org.slug)}`} className="underline-offset-4 hover:underline">
            Staff &amp; student sign in
          </Link>
          {" · "}
          <Link
            href={`/school/${encodeURIComponent(org.slug)}/verify-certificate`}
            className="underline-offset-4 hover:underline"
          >
            Verify a certificate
          </Link>
        </p>
      </footer>
    </div>
  );
}
