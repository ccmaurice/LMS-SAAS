import type { Metadata } from "next";
import Link from "next/link";
import { TranslationTool } from "@/components/tools/translation-tool";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Translation tool",
  description: "Translate text between English and many other languages.",
};

export default function TranslateToolPage() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-muted/40 to-background px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/tools" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
            ← All tools
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
            Home
          </Link>
        </div>
        <TranslationTool />
      </div>
    </div>
  );
}
