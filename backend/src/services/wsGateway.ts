// ==============================================
//  PyroSense Websocket Gateway
//  Risk guncellemelerini bagli istemcilere gercek zamanli iletir
// ==============================================

import { WebSocketServer, WebSocket } from "ws";
import { WEBSOCKET_PORT } from "../constants/index";

let wss: WebSocketServer | null = null;

export function startWsGateway(): void {
    const port = parseInt(WEBSOCKET_PORT);

    wss = new WebSocketServer({ port: port });

    wss.on("connection", (ws) => {
        console.log(`[WS] istemci baglandi (toplam: ${wss!.clients.size})`);

        ws.on("close", () => {
            console.log(`[WS] istemci ayrildi (toplam ${wss!.clients.size})`);
        });

        ws.on("error", (err) => {
            console.error(`[WS] hata: ${err.message}`);
        });
    });

    console.log(`WebSocket gateway: ws://localhost:${port}`);
}

export function broadcast(data: object): void {
    if (!wss || wss.clients.size === 0) {
        return;
    }

    const payload = JSON.stringify(data);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}
