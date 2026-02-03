export async function generateSignature(
  method: string,
  path: string
): Promise<{ timestamp: string; signature: string }> {
  const secret = import.meta.env.VITE_API_SECRET;

  if (!secret) {
    throw new Error(
      "VITE_API_SECRET is not set. The client was built without the API secret. " +
        "Rebuild for production with: npm run build-client:heroku -- <your-heroku-app-name> " +
        "then redeploy (e.g. npm run push-heroku -- <your-heroku-app-name>)."
    );
  }

  const timestamp = Date.now().toString();
  const message = `${timestamp}${method.toUpperCase()}${path}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return { timestamp, signature };
}
