import { describe, expect, it } from "vitest";
import {
  prepareWebvizRefSpec,
  rewriteWebvizS3RefsToPublicHttp,
} from "@/zarr-store/webvizRefs";

const sourceSpec = {
  version: 1,
  refs: {
    ".zgroup": '{"zarr_format":2}',
    ".zattrs": '{"title":"DPIRD"}',
    "airTemperature/.zarray":
      '{"shape":[192,105248],"chunks":[96,52624],"dtype":"<f8","fill_value":"NaN","order":"C","filters":[{"id":"shuffle","elementsize":8},{"id":"zlib","level":7}],"dimension_separator":".","compressor":null,"attributes":{},"zarr_format":2}',
    "airTemperature/.zattrs":
      '{"coordinates":"code lat lon","_ARRAY_DIMENSIONS":["station","time"]}',
    "airTemperature/0.0": [
      "s3://webviz/DPIRD/dpird_wa_stations.nc",
      394727937,
      11823953,
    ],
    "airTemperature/1.0": ["https://example.com/already-http.bin", 0, 16],
    "airTemperature/metadata": { nested: ["s3://webviz/unchanged"] },
  },
};

describe("ref rewrite", () => {
  it("keeps the source spec untouched", () => {
    const before = JSON.stringify(sourceSpec);
    const next = rewriteWebvizS3RefsToPublicHttp(sourceSpec);

    expect(JSON.stringify(sourceSpec)).toBe(before);
    expect(sourceSpec.refs["airTemperature/0.0"][0]).toBe(
      "s3://webviz/DPIRD/dpird_wa_stations.nc",
    );
    expect(next).not.toBe(sourceSpec);
  });

  it("rewrites only matching s3://webviz chunk refs", () => {
    const prepared = prepareWebvizRefSpec(sourceSpec);

    expect(prepared.refs["airTemperature/0.0"][0]).toBe(
      "https://projects.pawsey.org.au/webviz/DPIRD/dpird_wa_stations.nc",
    );
    expect(prepared.refs["airTemperature/1.0"]).toEqual(
      sourceSpec.refs["airTemperature/1.0"],
    );
    expect(prepared.refs["airTemperature/.zarray"]).toBe(
      sourceSpec.refs["airTemperature/.zarray"],
    );
  });

  it("deep copies nested ref values even when they are not rewritten", () => {
    const prepared = rewriteWebvizS3RefsToPublicHttp(sourceSpec);

    expect(prepared.refs["airTemperature/metadata"]).toEqual(
      sourceSpec.refs["airTemperature/metadata"],
    );
    expect(prepared.refs["airTemperature/metadata"]).not.toBe(
      sourceSpec.refs["airTemperature/metadata"],
    );
  });
});
