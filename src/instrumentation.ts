export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!proxy) return;
  const { ProxyAgent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new ProxyAgent(proxy));
  console.log(`[instrumentation] Routing fetch() through HTTPS_PROXY=${proxy}`);
}
