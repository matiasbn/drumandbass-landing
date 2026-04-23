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
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#000000;padding:20px 24px;border:4px solid #000000;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:3px;">
                    DRUM AND BASS CHILE
                  </td>
                  <td align="right" style="font-family:'Space Mono','Courier New',monospace;font-size:10px;color:#ff0055;text-transform:uppercase;letter-spacing:1px;">
                    drumandbasschile.cl
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Red accent line -->
          <tr>
            <td style="background-color:#ff0055;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="padding:8px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:4px solid #000000;background-color:#ffffff;">

                ${imageBase64 ? `
                <!-- Image -->
                <tr>
                  <td style="padding:24px 24px 0 24px;text-align:center;">
                    <img src="${imageBase64}" alt="" width="100%" style="max-width:100%;height:auto;display:block;border:4px solid #000000;" />
                  </td>
                </tr>
                ` : ''}

                <!-- Title -->
                <tr>
                  <td style="padding:24px 24px 0 24px;">
                    <h2 style="margin:0;font-family:'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#000000;text-transform:uppercase;line-height:1.2;">${title}</h2>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:16px 24px;">
                    <div style="border-top:4px solid #000000;"></div>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:0 24px 24px 24px;font-family:'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#333333;">
                    ${body}
                  </td>
                </tr>

                ${buttonText && buttonUrl ? `
                <!-- CTA Button -->
                <tr>
                  <td style="padding:0 24px 32px 24px;" align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td>
                          <!-- Shadow layer -->
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background-color:#000000;padding-top:6px;padding-left:6px;">
                                <a href="${buttonUrl}" style="display:inline-block;background-color:#ff0055;color:#ffffff;font-family:'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:700;text-transform:uppercase;font-size:14px;padding:14px 36px;text-decoration:none;letter-spacing:2px;border:4px solid #000000;">${buttonText}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:4px solid #000000;">
                <tr>
                  <td style="padding:20px 0;text-align:center;">
                    <p style="margin:0 0 4px 0;font-family:'Space Mono','Courier New',monospace;font-size:11px;color:#999999;text-transform:uppercase;letter-spacing:1px;">Drum and Bass Chile</p>
                    <p style="margin:0;font-family:'Space Mono','Courier New',monospace;font-size:11px;">
                      <a href="https://drumandbasschile.cl" style="color:#ff0055;text-decoration:none;font-weight:700;">drumandbasschile.cl</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
