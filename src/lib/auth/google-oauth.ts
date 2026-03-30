type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  id: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
};

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? json.error ?? "Token exchange failed");
  }
  return json.access_token;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("Failed to load Google profile");
  }
  return (await res.json()) as UserInfo;
}
