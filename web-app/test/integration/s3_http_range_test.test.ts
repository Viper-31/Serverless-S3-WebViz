import { describe, expect, it } from "vitest";

const runOnline = process.env.RUN_ONLINE_INTEGRATION === "1";
const onlineDescribe = runOnline ? describe : describe.skip;

onlineDescribe("s3_http_range_test", () => {
  it("performs anonymous HTTPS range fetch against the real DPIRD object", async () => {
    const url =
      "https://projects.pawsey.org.au/webviz/DPIRD/dpird_wa_stations.nc";
    // Tiny subrange from acacia_refs_staging/refs/DPIRD/dpird_wa_stations.nc.json -> airTemperature/0.0.
    const firstByte = 394727937;
    const lastByte = 394728064;
    const expectedByteLength = lastByte - firstByte + 1;
    const request = new Request(url, {
      headers: { Range: `bytes=${firstByte}-${lastByte}` },
      credentials: "omit",
    });

    expect(request.credentials).toBe("omit");
    expect(request.headers.has("authorization")).toBe(false);

    const response = await fetch(request);

    expect(response.status).toBe(206);
    expect(
      response.headers.get("accept-ranges") ||
        response.headers.get("content-range"),
    ).toBeTruthy();
    expect(response.headers.get("content-range")).toContain(
      `${firstByte}-${lastByte}`,
    );
    expect(new URL(response.url).search).toBe("");

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBe(expectedByteLength);
  });
});
