import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/auth/context";
import { OnboardingForm } from "@/components/app/onboarding-form";
import { BrandMark } from "@/components/app/brand";

export const metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  if (state.status === "ok") redirect("/copilot");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <BrandMark className="mb-10" />
        <OnboardingForm />
      </div>
    </main>
  );
}
