"use server";

import { sendEmail } from "@/lib/email";

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
    
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>You have been invited!</h2>
        <p>You have been invited to join the Insurance Portal as a <strong>${displayRole}</strong>.</p>
        <p>Please click the link below to accept your invitation and create your account:</p>
        <div style="margin: 20px 0;">
          <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
        </div>
        <p>If you did not expect this invitation, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">Insurance Portal Team</p>
      </div>
    `;
    
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
