"use client";

import { ClaimTracker } from "@/components/dashboard/user/claim-tracker";
import { NextSteps } from "@/components/dashboard/user/next-steps";
import { DocumentVault } from "@/components/dashboard/user/document-vault";
import { ContactHelper } from "@/components/dashboard/user/contact-helper";
import { PaymentStatus } from "@/components/dashboard/user/payment-status";

// ── Mock Data ───────────────────────────────────────────────────────────
const mockClaim = {
  claimNumber: "CLM-ABC-00042",
  policyType: "motor" as const,
  status: "under_review" as const,
  description: "Rear-end collision on Mombasa Road",
  createdAt: "2026-02-10",
};

const mockNextStep = {
  actionRequired: true,
  message: "Please upload a police abstract for your motor claim.",
  claimNumber: "CLM-ABC-00042",
};

const mockDocuments = [
  {
    id: "1",
    name: "Motor Policy Document.pdf",
    type: "application/pdf",
    size: 245000,
    uploadedAt: "2026-01-15",
  },
  {
    id: "2",
    name: "Accident Photo - Front.jpg",
    type: "image/jpeg",
    size: 1200000,
    uploadedAt: "2026-02-10",
  },
  {
    id: "3",
    name: "Accident Photo - Rear.jpg",
    type: "image/jpeg",
    size: 980000,
    uploadedAt: "2026-02-10",
  },
  {
    id: "4",
    name: "Drivers License.pdf",
    type: "application/pdf",
    size: 512000,
    uploadedAt: "2026-02-10",
  },
  {
    id: "5",
    name: "Dashcam Footage.mp4",
    type: "video/mp4",
    size: 52400000,
    uploadedAt: "2026-02-11",
  },
];

const mockAgent = {
  name: "James Kariuki",
  phone: "+254712345678",
  email: "james.kariuki@abcinsurance.co.ke",
};

const mockPayment = {
  status: "pending" as const,
  expectedAmount: 185000,
  currency: "KES",
  referenceNumber: null,
};

export default function UserDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome back, Sarah
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s an overview of your insurance claims and policies.
          </p>
        </div>

        {/* Claim Tracker + Next Steps */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ClaimTracker claim={mockClaim} />
          </div>
          <div>
            <NextSteps step={mockNextStep} />
          </div>
        </div>

        {/* Document Vault + Contact + Payment */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DocumentVault documents={mockDocuments} />
          </div>
          <div className="flex flex-col gap-6">
            <ContactHelper agent={mockAgent} />
            <PaymentStatus payment={mockPayment} />
          </div>
        </div>
      </div>
    </div>
  );
}
