export function getInviteEmailHtml(displayRole: string, inviteLink: string): string {
  return `
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
}

export function getPasswordResetEmailHtml(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Reset your password</h2>
      <p>We received a request to reset the password for your Insurance Portal account.</p>
      <div style="margin: 20px 0;">
        <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </div>
      <p>If you did not request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Insurance Portal Team</p>
    </div>
  `;
}

export function getVerifyEmailHtml(verificationLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Verify your email</h2>
      <p>Please confirm this email address so your Insurance Portal account stays secure.</p>
      <div style="margin: 20px 0;">
        <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
      </div>
      <p>If you did not request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">Insurance Portal Team</p>
    </div>
  `;
}
