import type { GameState } from "./types";
type ConnectionStatus = "offline" | "connecting" | "online" | "reconnecting";
export class Network {
  socket: WebSocket | null = null;
  owner = -1;
  room = "";
  token = "";
  latency = 0;
  status: ConnectionStatus = "offline";
  onState: (state: GameState) => void = () => {};
  onStatus: (status: ConnectionStatus) => void = () => {};
  onError: (message: string) => void = () => {};
  onWelcome: () => void = () => {};
  private manual = false;
  private attempt = 0;
  private reconnectTimer = 0;
  private pingTimer = 0;
  private hello: Record<string, unknown> = {};
  connect(hello: Record<string, unknown>) {
    this.disconnect();
    this.manual = false;
    this.attempt = 0;
    this.token = "";
    this.owner = -1;
    this.room = "";
    this.hello = hello;
    this.open();
  }
  private setStatus(s: ConnectionStatus) {
    this.status = s;
    this.onStatus(s);
  }
  private open() {
    this.setStatus(this.attempt ? "reconnecting" : "connecting");
    const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
    const url = configured
      ? configured.replace(/^http/, "ws").replace(/\/$/, "") + "/ws"
      : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.onError(
        "Sunucu adresi geçersiz. VITE_SERVER_URL ayarını kontrol et.",
      );
      this.setStatus("offline");
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.send(
        this.token
          ? {
              type: "join",
              room: this.room,
              token: this.token,
              faction: this.owner,
              heroClass: 0,
            }
          : this.hello,
      );
    };
    socket.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        this.owner = msg.owner;
        this.room = msg.room;
        this.token = msg.token;
        this.attempt = 0;
        this.setStatus("online");
        this.onWelcome();
        clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(
          () => this.send({ type: "ping", stamp: performance.now() }),
          2000,
        );
      } else if (msg.type === "state") this.onState(msg);
      else if (msg.type === "error") {
        this.onError(msg.message);
      } else if (msg.type === "pong")
        this.latency = Math.round(performance.now() - msg.stamp);
    };
    socket.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.manual) return;
      if (this.token && this.attempt < 8) {
        this.attempt++;
        this.setStatus("reconnecting");
        this.reconnectTimer = window.setTimeout(
          () => this.open(),
          Math.min(4000, 500 * this.attempt),
        );
      } else {
        this.setStatus("offline");
        if (!this.token)
          this.onError(
            "Bağlantı kurulamadı veya oda katılımı reddedildi. Go sunucusunun açık olduğundan ve seçtiğin faction’ın boş olduğundan emin ol.",
          );
        else this.onError("Bağlantı koptu. Sunucuya erişimi kontrol et.");
      }
    };
    socket.onerror = () => {};
  }
  send(command: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(command));
  }
  disconnect() {
    this.manual = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("offline");
  }
}
