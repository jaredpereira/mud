import { makeRouter } from "./lib/api";
import { handleOptions } from "./lib/handleOptions";
import { SignupRoute } from "./routes/signup";
export { SpaceDurableObject } from "./SpaceDurableObject";

export default {
  fetch: handleRequest,
};

const Routes = [SignupRoute];
export type WorkerRoutes = typeof Routes;

let router = makeRouter(Routes);

export type Bindings = {
  APP_EVENT_ANALYTICS: AnalyticsEngineDataset;
  SPACES: DurableObjectNamespace;
  USER_UPLOADS: R2Bucket;
};

async function handleRequest(request: Request, env: Bindings) {
  let url = new URL(request.url);
  let path = url.pathname.split("/");
  if (path[1] !== "v0")
    return new Response("You must use /v0/ for this API", { status: 404 });
  if (request.method === "OPTIONS") return handleOptions(request);
  if (path[2] === "api") return router(path[3], request, env);
  if (path[2] === "space") {
    let spaceID = path[3];
    let id = env.SPACES.idFromString(spaceID);
    let stub = env.SPACES.get(id);
    let newUrl = new URL(request.url);
    newUrl.pathname = "/" + path.slice(4).join("/");

    if (path[4] === "internal_api")
      return new Response("Internal only", { status: 401 });
    newUrl.pathname = "/" + path.slice(4).join("/");

    let result = await stub.fetch(
      new Request(newUrl.toString(), new Request(request))
    );
    return new Response(result.body, result);
  }
  if (path[2] === "static") {
    try {
      const object = await env.USER_UPLOADS.get(path[3]);

      if (!object || !object.body) {
        return new Response("Object Not Found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-control", "public, max-age=15552000");

      return new Response(object.body, {
        headers,
      });
    } catch (e) {
      console.log(e);
    }
  }
}
