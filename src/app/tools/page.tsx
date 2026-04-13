import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tools",
  description: "Utility tools for SkillTech LMS.",
};

export default function ToolsIndexPage() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-muted/40 to-background px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
            Home
          </Link>
        </div>
        <Link href="/tools/translate" className="block rounded-xl ring-1 ring-foreground/10 transition hover:bg-muted/50">
          <Card className="border-0 shadow-none ring-0">
            <CardHeader>
              <CardTitle className="text-base">Translation</CardTitle>
              <CardDescription>Translate text with server-side LibreTranslate or MyMemory.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
