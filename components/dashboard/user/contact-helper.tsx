"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MessageCircle, Mail, UserCircle } from "lucide-react";

interface ContactHelperProps {
  agent: {
    name: string;
    phone: string;
    email: string;
  };
}

export function ContactHelper({ agent }: ContactHelperProps) {
  const whatsappUrl = `https://wa.me/${agent.phone.replace(/[^0-9]/g, "")}`;
  const telUrl = `tel:${agent.phone}`;
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
            <p className="text-xs text-muted-foreground">{agent.phone}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <a href={telUrl}>
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Call
            </Button>
          </a>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button
              size="sm"
              className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
          </a>
          <a href={mailUrl}>
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
