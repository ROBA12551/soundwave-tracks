const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO  = process.env.GITHUB_REPO;

exports.handler = async (event) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    // ✅ CORS preflight 対応
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers,
            body: ""
        };
    }

    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Request body required" })
            };
        }

        const { username } = JSON.parse(event.body);

        if (!username) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Username required" })
            };
        }

        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
            throw new Error("GitHub environment variables not set");
        }

        const usersUrl =
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/users.json`;

        const usersResponse = await fetch(usersUrl, {
            headers: {
                "Authorization": `Bearer ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github+json"
            }
        });

        if (!usersResponse.ok) {
            throw new Error(`GitHub API error: ${usersResponse.status}`);
        }

        const usersData = await usersResponse.json();

        const users = JSON.parse(
            Buffer.from(usersData.content, "base64").toString("utf-8")
        );

        const user = users.find(u => u.username === username);

        if (!user) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: "User not found" })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                username: user.username,
                verified: Boolean(user.verified),
                verified_at: user.verified_at ?? null,
                role: user.role ?? "user"
            })
        };

    } catch (error) {
        console.error("get-user-verification error:", error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal server error" })
        };
    }
};
