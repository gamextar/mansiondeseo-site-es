function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function parseEmailList(value: unknown) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function confirmationEmailHtml(confirmUrl: string) {
  const safeUrl = escapeHtml(confirmUrl);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:0;background:#08080e;font-family:Arial,sans-serif}.wrap{max-width:480px;margin:0 auto;padding:40px 24px}.card{background:#111118;border-radius:16px;padding:40px 32px;border:1px solid rgba(201,168,76,.18)}.logo{text-align:center;font-size:24px;font-weight:700;color:#c9a84c;letter-spacing:1px;margin-bottom:8px}.sub{text-align:center;color:#aaa0ad;font-size:13px;margin-bottom:30px}.msg{color:#d5ced8;font-size:14px;line-height:1.6;text-align:center}.button{display:block;margin:28px auto 18px;width:max-content;background:#c9a84c;border-radius:10px;padding:13px 20px;color:#171119!important;font-weight:700;text-decoration:none}.fallback{text-align:center;color:#8f8792;font-size:12px;line-height:1.5;word-break:break-all}.footer{text-align:center;color:#555;font-size:11px;margin-top:30px}
</style></head><body><div class="wrap"><div class="card">
<div class="logo">MANSIÓN DESEO</div><div class="sub">Confirmación de cuenta de escorts</div>
<p class="msg">Hacé clic en el botón para confirmar tu email y activar tu cuenta de anunciante.</p>
<a class="button" href="${safeUrl}">Confirmar mi email</a>
<p class="fallback">Si el botón no funciona, copiá este enlace en tu navegador:<br>${safeUrl}</p>
<p class="msg">El enlace vence en 30 minutos. Si no solicitaste esta cuenta, podés ignorar este mensaje.</p>
</div><div class="footer">© Mansión Deseo · Este email fue enviado automáticamente</div></div></body></html>`;
}

export async function sendAccountVerificationEmail(env: Record<string, any>, toEmail: string, token: string) {
  const apiKey = String(env.RESEND_API_KEY || '');
  if (!apiKey) {
    console.error('Resend send failed: RESEND_API_KEY is not configured for escorts');
    return false;
  }

  const origin = String(env.PUBLIC_SITE_ORIGIN || 'https://escorts.mansiondeseo.com').replace(/\/$/, '');
  const confirmUrl = `${origin}/api/account/verify?token=${encodeURIComponent(token)}`;
  const fromEmail = String(env.MAIL_FROM || 'noreply@mansiondeseo.com');
  const bccRecipients = parseEmailList(env.REGISTRATION_EMAIL_BCC);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `Mansión Deseo <${fromEmail}>`,
        to: [toEmail],
        ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
        subject: 'Confirmá tu cuenta de Mansión Deseo Escorts',
        text: `Confirmá tu cuenta de Mansión Deseo Escorts abriendo este enlace: ${confirmUrl}\n\nEl enlace vence en 30 minutos.`,
        html: confirmationEmailHtml(confirmUrl),
      }),
    });

    if (!response.ok) {
      console.error(`Resend error ${response.status}:`, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Resend send failed:', error instanceof Error ? error.message : error);
    return false;
  }
}
