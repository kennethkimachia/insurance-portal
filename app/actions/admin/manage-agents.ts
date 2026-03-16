"use server";

import { sendEmail } from "@/lib/email";
import { getInviteEmailHtml } from "@/lib/emailTemplates";

export async function inviteAgent(data: { email: string; role: string }) {
  try {
    const { email, role } = data;
    
    if (!email || !role) {
      return { success: false, error: "Email and role are required." };
    }
    
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-up?email=${encodeURIComponent(email)}&role=${role}`;
    
    const roleLabels: Record<string, string> = {
      admin: "Admin",
      head_agent: "Head Agent",
      agent: "Agent",
    };
    
    const displayRole = roleLabels[role] || "Agent";
    
    const html = getInviteEmailHtml(displayRole, inviteLink);
    
    const response = await sendEmail({
      to: email,
      subject: `Invitation to join Insurance Portal as ${displayRole}`,
      html,
    });
    
    if (!response.success) {
      throw new Error("Failed to send email");
    }
    
    return { success: true };
  } catch (error) {
    console.error("Invite error:", error);
    return { success: false, error: "Failed to send invitation. Please try again." };
  }
}
