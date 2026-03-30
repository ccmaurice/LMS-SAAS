"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BlogPostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published: boolean;
  updatedAt: string;
  authorLabel: string;
};

export function BlogPostList({
  base,
  posts,
  showDraftBadges,
}: {
  base: string;
  posts: BlogPostCard[];
  showDraftBadges: boolean;
}) {
  const reduce = useReducedMotion();
  if (posts.length === 0) {
    return null;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-12">
      {posts.map((p, i) => (
        <motion.li
          key={p.id}
          className={i === 0 ? "md:col-span-8" : "md:col-span-4"}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.04 }}
          whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", stiffness: 500, damping: 26 } }}
        >
          <Link
            href={`${base}/${encodeURIComponent(p.slug)}`}
            className={cn(
              "surface-bento relative block h-full p-5 transition-colors hover:border-primary/30",
              i === 0 && "bento-course-active",
            )}
          >
            <div className="relative z-10 flex flex-wrap items-center gap-2">
              <h2 className="font-semibold tracking-tight text-foreground">{p.title}</h2>
              {!p.published && showDraftBadges ? <Badge variant="secondary">Draft</Badge> : null}
            </div>
            {p.excerpt ? (
              <p className="relative z-10 mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
            ) : null}
            <p className="relative z-10 mt-3 text-xs text-muted-foreground">
              {p.authorLabel} · {new Date(p.updatedAt).toLocaleDateString()}
            </p>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}
