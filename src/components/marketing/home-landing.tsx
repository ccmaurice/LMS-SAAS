"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { SchoolsCarousel, type SchoolCarouselItem } from "@/components/marketing/schools-carousel";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { HERO_BRAND_LOGO_IMG_CLASSES } from "@/lib/ui/brand-logo-classes";
import type { LandingFeature } from "@/lib/platform/landing-defaults";

export type HomeLandingProps = {
  schools: SchoolCarouselItem[];
  logoSrc: string | null;
  kicker: string;
  headline: string;
  subheadline: string;
  features: LandingFeature[];
};

export function HomeLanding({ schools, logoSrc, kicker, headline, subheadline, features }: HomeLandingProps) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [motionReady, setMotionReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- align SSR + first client paint; then honor reduced-motion
    setMotionReady(true);
  }, []);
  const runMotion = motionReady && !reduce;

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-app-mesh opacity-100 dark:opacity-100" aria-hidden />
      <div className="pointer-events-none absolute -left-32 top-1/4 size-96 rounded-full bg-glow-spot/25 blur-3xl dark:bg-glow-spot/35" aria-hidden />

      <div className="absolute right-4 top-4 z-50 md:right-8 md:top-8">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20 md:py-28">
        <motion.div
          initial={runMotion ? { opacity: 0, y: 16 } : false}
          animate={runMotion ? { opacity: 1, y: 0 } : undefined}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="text-center"
        >
          {logoSrc ? (
            <div className="mb-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- public URL or same-origin logo API */}
              <img src={logoSrc} alt="" className={HERO_BRAND_LOGO_IMG_CLASSES} />
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{kicker}</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tighter sm:text-5xl md:text-6xl">
            {headline}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            {subheadline}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "min-w-36 tracking-tight")}>
              {t("auth.signIn")}
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-w-36 border-border/80 backdrop-blur-sm dark:border-white/15")}
            >
              {t("auth.createSchool")}
            </Link>
            <Link href="/platform/login" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "tracking-tight")}>
              {t("landing.platform")}
            </Link>
          </div>
        </motion.div>

        <SchoolsCarousel schools={schools} />

        <motion.div
          className="mt-12 grid gap-4 md:grid-cols-3"
          initial={runMotion ? { opacity: 0, y: 20 } : false}
          animate={runMotion ? { opacity: 1, y: 0 } : undefined}
          transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.08 }}
        >
          {features.map((item, i) => (
            <motion.div
              key={`${item.title}-${i}`}
              className={cn("surface-bento p-5 md:p-6", item.span)}
              initial={runMotion ? { opacity: 0, y: 12 } : false}
              animate={runMotion ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 400, damping: 32 }}
              whileHover={runMotion ? { y: -3, transition: { type: "spring", stiffness: 500, damping: 25 } } : undefined}
            >
              <h2 className="text-sm font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          <Link href="/api/health" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("landing.apiHealth")}
          </Link>
        </p>
      </div>
    </div>
  );
}
