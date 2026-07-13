"use client";

import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,

  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Image from "next/image";
import { Loader2, Shield, X } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import { toast } from "sonner";

import Link from "next/link";

export default function SignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-muted/30 px-4 py-16 sm:px-6">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,var(--color-primary),transparent_65%)] opacity-10" />
      <Link href="/" className="fixed left-4 top-4 z-50 flex items-center gap-2 font-semibold sm:left-6 sm:top-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Shield className="size-5" /></span>
        <span className="hidden sm:inline">InsurePortal</span>
      </Link>
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ModeToggle />
      </div>
      <div className="relative w-full max-w-lg">
        <Card className="border bg-card shadow-xl shadow-foreground/5">
          <CardHeader className="border-b pb-5">
            <CardTitle className="text-2xl font-semibold">Create your account</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Set up secure access to your insurance portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    placeholder="Max"
                    required
                    onChange={(e) => {
                      setFirstName(e.target.value);
                    }}
                    value={firstName}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    placeholder="Robinson"
                    required
                    onChange={(e) => {
                      setLastName(e.target.value);
                    }}
                    value={lastName}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  value={email}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password_confirmation">Confirm Password</Label>
                <Input
                  id="password_confirmation"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm Password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="image">Profile Image (optional)</Label>
                <div className="flex items-end gap-4">
                  {imagePreview && (
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border">
                      <Image
                        src={imagePreview}
                        alt="Profile preview"
                        layout="fill"
                        objectFit="cover"
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full"
                    />
                    {imagePreview && (
                      <X
                        className="size-5 shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => {
                          setImage(null);
                          setImagePreview(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                onClick={async () => {
                  await signUp.email({
                    email,
                    password,
                    name: `${firstName} ${lastName}`,
                    image: image ? await convertImageToBase64(image) : "",
                    callbackURL: "/dashboard",
                    fetchOptions: {
                      onResponse: () => {
                        setLoading(false);
                      },
                      onRequest: () => {
                        setLoading(true);
                      },
                      onError: (ctx) => {
                        toast.error(ctx.error.message);
                      },
                      onSuccess: () => {
                        window.location.href = "/dashboard";
                      },
                    },
                  });
                }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Create your account"
                )}
              </Button>
              <div className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/sign-in" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function convertImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
