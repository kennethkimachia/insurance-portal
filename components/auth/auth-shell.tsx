import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { Shield } from "lucide-react";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative flex min-h-svh items-center justify-center bg-background px-4 py-24 sm:px-6">
      <Link
        href="/"
        className="absolute left-5 top-5 z-50 flex items-center gap-2.5 font-semibold tracking-tight sm:left-8 sm:top-7"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Shield className="size-5" />
        </span>
        <span className="hidden sm:inline">InsurePortal</span>
      </Link>
      <div className="absolute right-5 top-5 z-50 flex items-center gap-3 sm:right-8 sm:top-7">
        <Show when="signed-out">
          <Link href="/sign-in" className="text-sm font-medium hover:underline">Sign in</Link>
          <Link href="/sign-up" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Sign up</Link>
        </Show>
        <Show when="signed-in"><UserButton /></Show>
        <ModeToggle />
      </div>
      <Card className="w-full max-w-lg gap-0 rounded-2xl border-border/80 py-0 shadow-xl shadow-primary/5">
        <CardHeader className="border-b bg-muted/20 px-6 py-7 sm:px-8 sm:py-8">
          <CardTitle className="text-2xl tracking-tight sm:text-3xl">{title}</CardTitle>
          <CardDescription className="mt-1 leading-6">{description}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-7 sm:px-8 sm:py-8">{children}</CardContent>
      </Card>
    </div>
  );
}
