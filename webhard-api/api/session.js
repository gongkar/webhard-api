const { google } = require('googleapis');

const FOLDER_ID = '1WQpphfgBjBpjgZY5Yfq-gqdJfxta4Sue';

async function getAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { filename, filesize, mimeType = 'application/octet-stream' } = body || {};

    if (!filename || !filesize) {
      return res.status(400).json({ error: 'filename, filesize 필수', received: body });
    }

    console.log('[요청]', filename, filesize, mimeType);

    const accessToken = await getAccessToken();
    console.log('[인증 성공]');

    const initResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(filesize),
        },
        body: JSON.stringify({
          name: filename,
          parents: [FOLDER_ID],
        }),
      }
    );

    const errText = await initResponse.text();
    console.log('[Drive 응답]', initResponse.status, errText.substring(0, 300));

    if (!initResponse.ok) {
      return res.status(502).json({ error: '세션 생성 실패', detail: errText });
    }

    const sessionUri = initResponse.headers.get('location');
    console.log('[세션 URI 획득]', sessionUri ? '성공' : '실패');
    res.json({ sessionUri });

  } catch (err) {
    console.error('[오류]', err.message);
    res.status(500).json({ error: err.message });
  }
};
