import { CircleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AgencyLogo } from "@/components/app/agency-logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getUser } from "@/lib/auth/session";
import { resolveBrandColor } from "@/lib/brand";
import { logoUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "../../actions";
import { InviteForms } from "./invite-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.invite");
  return { title: t("metaTitle") };
}

export default async function InvitePage({ params }: PageProps<"/[locale]/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations("auth.invite");
  const tr = await getTranslations("roles");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitation_preview", { p_token: token });
  const invite = data?.[0];
  const user = await getUser();

  if (!invite || invite.state !== "valid" || !invite.agency_name) {
    const state = invite?.state ?? "invalid";
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:pt-8">
          <CircleAlertIcon className="size-12 text-warning" aria-hidden />
          <h1 className="text-2xl font-bold">{t(`state.${state}.title`)}</h1>
          <p className="text-muted-foreground">{t(`state.${state}.body`)}</p>
          <Button asChild size="lg" className="w-full">
            <Link href={user ? "/dashboard" : "/login"}>{user ? t("goToApp") : t("goToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const brand = resolveBrandColor(invite.brand_color);
  const wrongAccount = Boolean(user && invite.email && user.email?.toLowerCase() !== invite.email);

  return (
    <div className="flex flex-col gap-4" style={{ ["--brand" as string]: brand.brand, ["--brand-foreground" as string]: brand.foreground }}>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center sm:pt-8">
          <AgencyLogo name={invite.agency_name} url={logoUrl(invite.logo_path)} size={72} />
          <h1 className="text-2xl font-bold">{t("title", { agency: invite.agency_name })}</h1>
          <p className="text-muted-foreground">{t("subtitle", { role: tr(invite.role ?? "staff") })}</p>
        </CardContent>
      </Card>

      {wrongAccount ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <Alert variant="warning">{t("wrongAccount", { invited: invite.email ?? "", current: user?.email ?? "" })}</Alert>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="lg" className="w-full">
                {t("logout")}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <InviteForms token={token} locale={locale} loggedIn={Boolean(user)} invitedEmail={invite.email} />
      )}
    </div>
  );
}
