import { SignIn } from "@clerk/nextjs";
import { Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="container relative min-h-[calc(100vh-4rem)] flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex justify-between overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

        <div className="relative z-20 flex items-center text-lg font-bold gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-amber-500 shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">ListingLift</span>
        </div>

        <div className="relative z-20 my-auto max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>10 Free Trial Credits on Signup</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight leading-tight sm:text-4xl text-white">
            Turn ordinary phone snaps into multi-channel revenue.
          </h2>

          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>AI Studio Photography (White background, luxury pedestals)</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>Full Meesho Catalog Copy + High-converting Descriptions</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>Ready-to-broadcast WhatsApp & Instagram Story Cards</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <span>Atomic multi-turn image re-editing with prompt guidance</span>
            </li>
          </ul>

          <div className="pt-4 border-t border-slate-800 flex items-center gap-3 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span>Trusted by 25,000+ Indian Resellers and D2C Brands</span>
          </div>
        </div>

        <div className="relative z-20 text-xs text-slate-400">
          © {new Date().getFullYear()} ListingLift. Empowering Bharat's Commerce.
        </div>
      </div>

      <div className="p-8 flex items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[380px]">
          <SignIn
            routing="path"
            path="/login"
            signUpUrl="/login"
            fallbackRedirectUrl="/app/dashboard"
          />
        </div>
      </div>
    </div>
  );
}
