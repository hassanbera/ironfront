package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func TestWebsocketOriginAndLobbyHostMigration(t *testing.T) {
	s := newServer([]string{"localhost:5173"})
	server := httptest.NewServer(s.handler(""))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	go s.run(ctx)
	url := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	conn, response, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": []string{"https://untrusted.example"}}})
	if conn != nil {
		conn.CloseNow()
	}
	if err == nil || response.StatusCode != http.StatusForbidden {
		t.Fatal("untrusted browser origin accepted")
	}
	connect := func(c Command) (*websocket.Conn, map[string]any) {
		t.Helper()
		ws, _, err := websocket.Dial(ctx, url, nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { ws.CloseNow() })
		if err = wsjson.Write(ctx, ws, c); err != nil {
			t.Fatal(err)
		}
		var welcome map[string]any
		if err = wsjson.Read(ctx, ws, &welcome); err != nil {
			t.Fatal(err)
		}
		if welcome["type"] != "welcome" {
			t.Fatal(welcome)
		}
		return ws, welcome
	}
	a, welcome := connect(Command{Type: "create", Faction: 0, Name: "Host"})
	room := welcome["room"].(string)
	b, _ := connect(Command{Type: "join", Room: room, Faction: 1, Name: "Guest"})
	if err := wsjson.Write(ctx, a, Command{Type: "leave"}); err != nil {
		t.Fatal(err)
	}
	for {
		var state Game
		if err := wsjson.Read(ctx, b, &state); err != nil {
			t.Fatal(err)
		}
		if state.Type == "state" && state.Host == 1 && state.Players[0] == nil {
			break
		}
	}
	_, replacement := connect(Command{Type: "join", Room: room, Faction: 0, Name: "Replacement"})
	if replacement["owner"].(float64) != 0 {
		t.Fatal("vacated lobby faction was not released")
	}
}
