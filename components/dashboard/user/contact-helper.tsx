"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, Mail, UserCircle } from "lucide-react";

interface ContactHelperProps {
  agent: {
    name: string;
    phone?: string | null;
    email: string;
  };
}

export function ContactHelper({ agent }: ContactHelperProps) {
  const whatsappUrl = agent.phone ? `https://wa.me/${agent.phone.replace(/[^0-9]/g, "")}` : null;
  const telUrl = agent.phone ? `tel:${agent.phone}` : null;
  const mailUrl = `mailto:${agent.email}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {agent.name}
            </p>
            {agent.phone && (
              <p className="text-xs text-muted-foreground">{agent.phone}</p>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {telUrl ? (
            <a href={telUrl}>
              <Button variant="outline" size="sm" className="w-full gap-1.5 px-1">
                <Phone className="h-3.5 w-3.5" />
                Call
              </Button>
            </a>
          ) : (
            <div />
          )}
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button
                size="sm"
                className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 px-1"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
            </a>
          ) : (
            <div />
          )}
          <a href={mailUrl} className={telUrl ? "" : "col-span-3"}>
            <Button variant="outline" size="sm" className="w-full gap-1.5 px-1">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
