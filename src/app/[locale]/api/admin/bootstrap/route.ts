// app/api/admin/bootstrap/route.ts
import admin from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { email, password, token } = await req.json();

    if (!token || token !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
      return Response.json({ error: "Forbidden: invalid bootstrap token" }, { status: 403 });
    }
    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // comprobar si ya existe un admin
    let hasAdmin = false;
    let nextPageToken: string | undefined = undefined;
    do {
      const page = await admin.auth().listUsers(1000, nextPageToken);
      hasAdmin = page.users.some((u) => (u.customClaims as any)?.admin === true);
      nextPageToken = page.pageToken;
    } while (nextPageToken && !hasAdmin);

    if (hasAdmin) {
      return Response.json({ error: "Admin already exists" }, { status: 409 });
    }

    const user = await admin.auth().createUser({
      email,
      password, // Firebase hashea por ti
      emailVerified: true,
      disabled: false,
    });

    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    return Response.json({ ok: true, uid: user.uid });
  } catch (e: any) {
    console.error("[admin/bootstrap] error:", e?.message, e?.stack);
    return Response.json({ error: e?.message ?? "Bootstrap error" }, { status: 400 });
  }
}
