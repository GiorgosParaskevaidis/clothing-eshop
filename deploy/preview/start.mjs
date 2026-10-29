import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const apiDirectory = process.env.PREVIEW_API_DIRECTORY ?? join(root, 'api');
const webDirectory = process.env.PREVIEW_WEB_DIRECTORY ?? join(root, 'web');
const apiPort = process.env.PREVIEW_API_PORT ?? '8080';
const webPort = process.env.PORT ?? '10000';
const publicUrl = process.env.Store__PublicUrl ?? process.env.RENDER_EXTERNAL_URL;

if (!publicUrl || new URL(publicUrl).protocol !== 'https:') {
    throw new Error('Set an HTTPS Store__PublicUrl or RENDER_EXTERNAL_URL for this preview.');
}
if (apiPort === webPort) {
    throw new Error('Frontend and internal API must listen on different ports.');
}
for (const key of ['ConnectionStrings__Store', 'Admin__Email', 'Admin__PasswordHash']) {
    if (!process.env[key]) throw new Error(`Missing preview setting: ${key}`);
}

const children = [];
let stopping = false;
function stop(exitCode) {
    if (stopping) return;
    stopping = true;
    process.exitCode = exitCode;
    for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    }
    const forceStop = setTimeout(() => {
        for (const child of children) {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        }
    }, 8000);
    forceStop.unref();
}
function launch(name, command, args, cwd, env) {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
    children.push(child);
    child.on('error', () => {
        console.error(`${name} could not start.`);
        stop(1);
    });
    child.on('exit', code => {
        if (!stopping) {
            console.error(`${name} stopped unexpectedly.`);
            stop(code || 1);
        }
    });
    return child;
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));

const apiUrl = `http://127.0.0.1:${apiPort}`;
const api = launch('API', 'dotnet', ['Thesamenot.Api.dll'], apiDirectory, {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Preview',
    ASPNETCORE_URLS: apiUrl,
    // Only the loopback Next.js proxy can reach this API. Honor its HTTPS
    // forwarding so Secure antiforgery cookies work behind Render's TLS edge.
    Proxy__KnownAddresses__0: '127.0.0.1',
    Store__PaymentMode: 'Simulation',
    Store__SalesEnabled: 'true',
    Store__PublicUrl: publicUrl.replace(/\/$/, ''),
    Stripe__SecretKey: '',
    Stripe__WebhookSecret: ''
});

let ready = false;
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
    try {
        const response = await fetch(apiUrl + '/api/health', { signal: AbortSignal.timeout(2000) });
        if (response.ok) { ready = true; break; }
    } catch {}
    if (api.exitCode !== null || api.signalCode !== null) break;
    await delay(500);
}
if (!ready || stopping) {
    if (!stopping) console.error('API did not become healthy; frontend will not start.');
    stop(stopping ? process.exitCode : 1);
} else {
    // Keep SQL/admin secrets out of the frontend process.
    const webEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        !/^(ConnectionStrings__|Admin__|Stripe__|Database__)/i.test(key)));
    launch('Frontend', process.execPath, ['server.js'], webDirectory, {
        ...webEnvironment,
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        PORT: webPort,
        API_INTERNAL_URL: apiUrl
    });
    console.log(`Preview frontend listening on port ${webPort}; API is internal only.`);
}
