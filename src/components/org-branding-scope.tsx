import { buildOrgBrandingCss, orgBrandClassSlug } from "@/lib/org-branding";
import { cn } from "@/lib/utils";

type OrgBrandingFields = {
  themeTemplate: string;
  customPrimaryHex: string | null;
  customAccentHex: string | null;
};

export function OrgBrandingScope({
  slug,
  org,
  children,
}: {
  slug: string;
  org: OrgBrandingFields;
  children: React.ReactNode;
}) {
  const css = buildOrgBrandingCss(slug, org.themeTemplate, org.customPrimaryHex, org.customAccentHex);
  const cls = cn(
    `org-brand-${orgBrandClassSlug(slug)}`,
    "flex min-h-full flex-1 flex-col print:h-auto print:min-h-0 print:overflow-visible",
  );

  return (
    <>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <div className={cls}>{children}</div>
    </>
  );
}
