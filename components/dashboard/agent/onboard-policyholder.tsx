"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, CheckCircle2, Upload } from "lucide-react";
import { useState } from "react";

interface OnboardPolicyholderProps {
  organizationName?: string;
}

export function OnboardPolicyholder({
  organizationName = "ABC Insurance",
}: OnboardPolicyholderProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    policyType: "" as "" | "motor" | "burglary",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [generatedPolicy, setGeneratedPolicy] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Mock: generate a policy number
    const num = Math.floor(10000 + Math.random() * 90000);
    setGeneratedPolicy(
      `POL-${organizationName.slice(0, 3).toUpperCase()}-${num}`,
    );
    setSubmitted(true);
  }

  function handleReset() {
    setFormData({ fullName: "", email: "", phone: "", policyType: "" });
    setIdFile(null);
    setSubmitted(false);
    setGeneratedPolicy("");
  }

  const isValid =
    formData.fullName.trim() &&
    formData.email.trim() &&
    formData.phone.trim() &&
    formData.policyType;

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Policyholder Created
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formData.fullName}
              </span>{" "}
              has been registered successfully.
            </p>
            <div className="mx-auto mt-4 w-fit rounded-lg border bg-muted/30 px-4 py-2">
              <p className="text-xs text-muted-foreground">Policy Number</p>
              <p className="text-lg font-bold font-mono tracking-wider text-foreground">
                {generatedPolicy}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={handleReset}
            >
              Register Another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Quick Create</CardTitle>
            <CardDescription>
              Register a new policyholder and generate their policy
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fullName: e.target.value }))
              }
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. John Kamau"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="john@example.com"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="+254 7XX XXX XXX"
            />
          </div>

          {/* Policy Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Policy Type
            </label>
            <Select
              value={formData.policyType}
              onValueChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  policyType: val as "motor" | "burglary",
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select policy type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motor">Motor</SelectItem>
                <SelectItem value="burglary">Burglary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ID Upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              National ID
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/30">
              <Upload className="h-4 w-4" />
              {idFile ? (
                <span className="text-foreground">{idFile.name}</span>
              ) : (
                <span>Upload ID document</span>
              )}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setIdFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={!isValid}>
            Register Policyholder
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
