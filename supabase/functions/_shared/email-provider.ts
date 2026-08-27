type InvitationEmail = {
  to: string;
  invitationUrl: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
};

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing server secret: ${name}`);
  }

  return value;
}

export async function sendInvitationEmail({ to, invitationUrl }: InvitationEmail): Promise<string> {
  const apiKey = requiredSecret('RESEND_API_KEY');
  const from = requiredSecret('INVITATION_FROM_EMAIL');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: '우리집 가족 초대가 도착했습니다',
      text: [
        '우리집 웹사이트의 가족 구성원으로 초대되었습니다.',
        '아래 주소를 열어 본인 이메일로 가입하거나 로그인한 뒤 초대를 수락해 주세요.',
        '',
        invitationUrl,
        '',
        '이 초대는 7일 후 만료되며 한 번만 사용할 수 있습니다.',
      ].join('\n'),
      html: [
        '<h1>우리집 가족 초대</h1>',
        '<p>가족 구성원으로 초대되었습니다.</p>',
        '<p>아래 버튼을 눌러 본인 이메일로 가입하거나 로그인한 뒤 초대를 수락해 주세요.</p>',
        `<p><a href="${invitationUrl}">초대 수락하기</a></p>`,
        '<p>이 초대는 7일 후 만료되며 한 번만 사용할 수 있습니다.</p>',
      ].join(''),
    }),
  });

  const result = (await response.json().catch(() => ({}))) as ResendResponse;

  if (!response.ok || !result.id) {
    throw new Error(`Email provider rejected the request: ${response.status}`);
  }

  return result.id;
}
