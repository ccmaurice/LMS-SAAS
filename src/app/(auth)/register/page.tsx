import { RegisterForm } from "@/components/auth/register-form";
import { MobileAppDownload } from "@/components/marketing/mobile-app-download";

export default function RegisterPage() {
  return (
    <>
      <RegisterForm />
      <MobileAppDownload compact />
    </>
  );
}
