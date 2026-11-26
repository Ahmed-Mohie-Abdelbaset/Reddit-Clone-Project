const base = process.env.BASE || "http://localhost:5000/api";

const call = (method, path, token, body) =>
  fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  }).then(async (response) => ({
    status: response.status,
    data: await response.json().catch(() => null),
  }));

(async () => {
  const login = await call("POST", "/auth/login", null, {
    email: "hamzah@example.com",
    password: "password123",
  });

  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status}`);
  }

  const token = login.data.token;
  const community = await call("GET", "/communities/FC27_community");

  if (community.status !== 200) {
    throw new Error(`community lookup failed: ${community.status}`);
  }

  const { _id } = community.data;
  const count = async () =>
    (await call("GET", "/communities/FC27_community")).data.memberCount;

  await call("POST", `/communities/${_id}/leave`, token);
  const before = await count();

  const joins = await Promise.all(
    Array.from({ length: 20 }, () =>
      call("POST", `/communities/${_id}/join`, token)
    )
  );
  const afterJoin = await count();

  const leaves = await Promise.all(
    Array.from({ length: 20 }, () =>
      call("POST", `/communities/${_id}/leave`, token)
    )
  );
  const afterLeave = await count();

  const badStatus = [...joins, ...leaves].find(
    (result) => result.status !== 200
  );

  if (badStatus) {
    console.log("FAIL", { status: badStatus.status, body: badStatus.data });
    process.exit(1);
  }

  const pass = afterJoin === before + 1 && afterLeave === before;
  console.log(pass ? "PASS" : "FAIL", { before, afterJoin, afterLeave });
  process.exit(pass ? 0 : 1);
})().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
