import { GET as modelGet, OPTIONS as modelOptions } from "../[...model]/route.js";

export { modelOptions as OPTIONS };

export async function GET(request, context) {
  const params = await context?.params;
  const kind = params?.kind;
  return modelGet(request, {
    params: Promise.resolve({ model: [kind] }),
  });
}
