"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type SchoolCarouselItem = {
  slug: string;
  name: string;
  heroImageUrl: string | null;
};

function SchoolCard({ school }: { school: SchoolCarouselItem }) {
  const { t } = useI18n();
  const [imgFailed, setImgFailed] = useState(false);
  const heroUrl = school.heroImageUrl?.trim() ?? "";
  const letter = school.name.slice(0, 1).toUpperCase() || "?";

  return (
    <Link
      href={`/school/${school.slug}`}
      className="group relative flex h-[min(52vh,420px)] w-[min(92vw,380px)] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-[transform,box-shadow] hover:z-10 hover:shadow-lg dark:border-white/10 md:w-[420px]"
    >
      <div className="relative h-[72%] w-full overflow-hidden bg-muted">
        {heroUrl ? (
          <>
            {/* Keep <img> in the tree whenever URL exists so SSR and hydration match; overlay fallback after onError */}
            {/* eslint-disable-next-line @next/next/no-img-element -- external school hero URLs */}
            <img
              src={heroUrl}
              alt=""
              className={cn(
                "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                imgFailed && "pointer-events-none opacity-0",
              )}
              onError={() => setImgFailed(true)}
            />
            {imgFailed ? (
              <div
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-accent/20 text-6xl font-semibold text-primary/40"
                aria-hidden
              >
                {letter}
              </div>
            ) : null}
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-accent/20 text-6xl font-semibold text-primary/40"
            aria-hidden
          >
            {letter}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-lg font-semibold tracking-tight text-foreground drop-shadow-sm">{school.name}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">/school/{school.slug}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center px-5 py-4">
        <p className="text-sm text-muted-foreground">{t("landing.schoolCardTeaser")}</p>
        <span className="mt-3 text-sm font-medium text-primary">{t("landing.schoolCardCta")}</span>
      </div>
    </Link>
  );
}

export function SchoolsCarousel({ schools }: { schools: SchoolCarouselItem[] }) {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  }, []);

  if (schools.length === 0) return null;

  return (
    <section className="mt-20 w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("landing.carouselKicker")}</p>
          <h2 className="page-title-lg mt-2">{t("landing.carouselTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("landing.carouselSubtitle")}</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label={t("landing.prevSchoolsAria")}
            className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("landing.nextSchoolsAria")}
            className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
            onClick={() => scroll(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pl-1 pr-6 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-6 [&::-webkit-scrollbar]:hidden"
      >
        {schools.map((s) => (
          <SchoolCard key={s.slug} school={s} />
        ))}
      </div>
    </section>
  );
}
