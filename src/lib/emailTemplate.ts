export function buildEmailHtml({
  title,
  body,
  imageBase64,
  buttonText,
  buttonUrl,
}: {
  title: string;
  body: string;
  imageBase64?: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:20px 0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111111;">
          <!-- Header -->
          <tr>
            <td style="background-color:#000000;padding:24px;text-align:center;border-bottom:4px solid #ff0055;">
              <h1 style="color:#ffffff;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Drum and Bass Chile</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 24px;">
              ${imageBase64 ? `
              <!-- Image -->
              <div style="text-align:center;margin-bottom:24px;">
                <img src="${imageBase64}" alt="" width="180" style="max-width:100%;height:auto;display:inline-block;" />
              </div>
              ` : ''}
              <!-- Title -->
              <h2 style="color:#ffffff;font-size:24px;font-weight:900;line-height:1.2;margin:0 0 16px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${title}</h2>
              <!-- Body -->
              <div style="color:#cccccc;font-size:15px;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${body}</div>
              ${buttonText && buttonUrl ? `
              <!-- CTA -->
              <div style="text-align:center;padding:24px 0;">
                <a href="${buttonUrl}" style="display:inline-block;background-color:#ff0055;color:#ffffff;font-weight:700;text-transform:uppercase;font-size:14px;padding:14px 32px;text-decoration:none;letter-spacing:1px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${buttonText}</a>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#000000;padding:20px 24px;text-align:center;border-top:4px solid #333333;">
              <p style="color:#666666;font-size:11px;margin:4px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Drum and Bass Chile</p>
              <p style="color:#666666;font-size:11px;margin:4px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><a href="https://drumandbasschile.cl" style="color:#ff0055;text-decoration:none;">drumandbasschile.cl</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
