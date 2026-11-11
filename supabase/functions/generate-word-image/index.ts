const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface RequestBody {
  finnish?: string;
  turkish?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { finnish, turkish } = (await req.json()) as RequestBody;
    if (!finnish || !turkish) {
      return json({ error: "finnish and turkish are required" }, 400);
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    if (!accountId || !apiToken) {
      return json({ error: "cloudflare_not_configured" }, 500);
    }

    const prompt = `A high quality, educational, flat vector style illustration of ${turkish.trim()} (Finnish: ${finnish.trim()}). White background, centered.`;

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
    const cfResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        num_steps: 4,
        width: 512,
        height: 512,
      }),
    });

    const responseText = await cfResponse.text();
    if (!cfResponse.ok) {
      console.error("Cloudflare AI error", cfResponse.status, responseText);
      return json({ error: "image_generation_failed" }, 502);
    }

    let responseData: { result?: { image?: string } };
    try {
      responseData = JSON.parse(responseText) as { result?: { image?: string } };
    } catch {
      console.error("Cloudflare AI returned invalid JSON");
      return json({ error: "invalid_image_response" }, 502);
    }

    const base64Image = responseData.result?.image;
    if (!base64Image) {
      console.error("Cloudflare AI response did not contain result.image");
      return json({ error: "empty_image" }, 502);
    }

    let imageBuffer: Uint8Array;
    try {
      const binary = atob(base64Image);
      imageBuffer = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
      console.error("Cloudflare AI returned invalid base64 image data");
      return json({ error: "invalid_image_data" }, 502);
    }

    if (imageBuffer.byteLength === 0) {
      return json({ error: "empty_image" }, 502);
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fileName = `${crypto.randomUUID()}.png`;
    const path = `ai/${fileName}`;
    const { error: uploadError } = await admin.storage
      .from("word-images")
      .upload(path, imageBuffer, { contentType: "image/png", upsert: false });

    if (uploadError) {
      console.error("Storage upload error", uploadError);
      return json({ error: "storage_failed" }, 500);
    }

    const { data } = admin.storage.from("word-images").getPublicUrl(path);
    return json({ url: data.publicUrl });
  } catch (err) {
    console.error("generate-word-image failed", err);
    return json({ error: "server_error" }, 500);
  }
});


