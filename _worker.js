export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // SIGN UP
    if (url.pathname === "/api/signup" && request.method === "POST") {

      const data = await request.json();

      const username = String(data.username || "").trim();
      const password = String(data.password || "");
      const country = String(data.country || "🇧🇩");
      const avatar = String(data.avatar || "🙂");

      if (username.length < 3) {
        return response({
          success: false,
          error: "Username must be at least 3 characters."
        }, 400);
      }

      if (password.length < 6) {
        return response({
          success: false,
          error: "Password must be at least 6 characters."
        }, 400);
      }

      const exists = await env.DB
        .prepare("SELECT id FROM users WHERE username = ?")
        .bind(username)
        .first();

      if (exists) {
        return response({
          success: false,
          error: "Username already exists."
        }, 409);
      }

      const passwordHash = await hashPassword(password);

      const result = await env.DB
        .prepare(`
          INSERT INTO users
          (username, password, country, avatar, xp, lives, streak, rating)
          VALUES (?, ?, ?, ?, 0, 3, 1, 1000)
        `)
        .bind(
          username,
          passwordHash,
          country,
          avatar
        )
        .run();

      return response({
        success: true,
        userId: result.meta.last_row_id,
        message: "Account created successfully."
      });
    }


    // LOGIN
    if (url.pathname === "/api/login" && request.method === "POST") {

      const data = await request.json();

      const username = String(data.username || "").trim();
      const password = String(data.password || "");

      const user = await env.DB
        .prepare(`
          SELECT
            id,
            username,
            password,
            country,
            avatar,
            xp,
            lives,
            streak,
            rating
          FROM users
          WHERE username = ?
        `)
        .bind(username)
        .first();

      if (!user) {
        return response({
          success: false,
          error: "Invalid username or password."
        }, 401);
      }

      const valid = await verifyPassword(
        password,
        user.password
      );

      if (!valid) {
        return response({
          success: false,
          error: "Invalid username or password."
        }, 401);
      }

      delete user.password;

      return response({
        success: true,
        user
      });
    }


    // USER PROFILE
    if (url.pathname === "/api/user") {

      const id = url.searchParams.get("id");

      if (!id) {
        return response({
          success: false,
          error: "User ID required."
        }, 400);
      }

      const user = await env.DB
        .prepare(`
          SELECT
            id,
            username,
            country,
            avatar,
            xp,
            lives,
            streak,
            rating
          FROM users
          WHERE id = ?
        `)
        .bind(id)
        .first();

      if (!user) {
        return response({
          success: false,
          error: "User not found."
        }, 404);
      }

      return response({
        success: true,
        user
      });
    }


    // LEADERBOARD
    if (url.pathname === "/api/leaderboard") {

      const world =
        url.searchParams.get("world") || "english";

      const subject =
        url.searchParams.get("subject") || "language";

      const result = await env.DB
        .prepare(`
          SELECT
            u.id,
            u.username,
            u.country,
            u.avatar,
            l.xp,
            l.rating
          FROM leaderboard l
          JOIN users u
            ON u.id = l.user_id
          WHERE l.world = ?
          AND l.subject = ?
          ORDER BY l.xp DESC, l.rating DESC
          LIMIT 100
        `)
        .bind(world, subject)
        .all();

      return response({
        success: true,
        leaderboard: result.results
      });
    }


    // WEBSITE
    return env.ASSETS.fetch(request);
  }
};


// PASSWORD HASH

async function hashPassword(password) {

  const data =
    new TextEncoder().encode(password);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array
    .from(new Uint8Array(hash))
    .map(
      b => b.toString(16).padStart(2, "0")
    )
    .join("");
}


async function verifyPassword(
  password,
  storedHash
) {

  const hash =
    await hashPassword(password);

  return hash === storedHash;
}


// RESPONSE

function response(data, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers:{
        "content-type":
          "application/json;charset=UTF-8",
        "cache-control":
          "no-store"
      }
    }
  );
}
